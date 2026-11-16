let activeChannel = 63;
let spectrumWidget, spectrumObject, displayedSpectrum;
const sourceSpectra = new Map();
let preparedSpectra;

function sourceSpectrum(source, cataloged){
 const saved = data.radiance[source.id];
 if (saved?.some(Number.isFinite) || !cataloged) return {values:saved};
 const cached = sourceSpectra.get(source.id);
 if (cached) return cached;

 const state = {status:'loading'};
 sourceSpectra.set(source.id,state);
 const load = async () => {
  if (source.poc){
   preparedSpectra ??= fetch('./poc-spectra.json')
    .then(response => response.ok ? response.json() : {}).catch(() => ({}));
   const values = (await preparedSpectra)[source.poc.key];
   if (Array.isArray(values)) return values;
  }
  const [ra,dec] = gaiaPosition(source,2025.75);
  const query = new URLSearchParams({ra:ra.toFixed(5),dec:dec.toFixed(5)});
  const response = await fetch('/api/source-spectrum?'+query);
  if (!response.ok) throw Error(response.status);
  return (await response.json()).radiance;
 };
 load().then(values => {
  state.values = values;
  state.status = 'ready';
  data.radiance[source.id] = values;
 }).catch(() => {
  state.status = 'error';
 }).finally(() => {
  if (selected === source.id) render();
 });
 return state;
}

function syncSpectrumChannel(channel){
 activeChannel = channel;
 if (byId('spectral-channel')) byId('spectral-channel').value = channel;
 updateObjectObservation();
}

function chooseImageChannel(channel){
 const picker = byId('image-channel');
 if (Number(picker.value) === channel) return;
 picker.value = channel;
 picker.dispatchEvent(new Event('change'));
}

function updateObjectObservation(){
 const date = byId('observation-date');
 const instrument = byId('image-source');
 if (!date || !instrument) return;
 const isSpherex = instrument.value === 'spherex';
 byId('object-epoch').textContent = !isSpherex ? t('Mosaico') :
  date.value ? date.selectedOptions[0].textContent : t('Mosaico DR1');
 const color = byId('image-mode').value === 'rgb';
 byId('object-image-layer').textContent = !isSpherex ? instrument.selectedOptions[0].textContent :
  color ? 'SPHEREx · RGB' : 'SPHEREx · '+fmt(data.wavelengths[activeChannel-1])+' µm';
}

function renderObjectIdentity(object, gaia){
 if (!object) return;
 const [ra,dec] = gaia ? gaiaPosition(object) : [object.ra_icrs_deg,object.dec_icrs_deg];
 byId('object-name').textContent = object.poc?.name ?? object.id;
 byId('object-kind').textContent = object.poc ? t('Alvo da demonstração') : gaia ? t('Fonte Gaia DR3') : t('Candidato para revisão');
 byId('object-position-label').textContent = gaia && !object.poc ? t('Posição · Gaia DR3') : t('Posição · ICRS');
 byId('object-position').textContent = 'RA '+fmt(ra,6)+'° · Dec '+fmt(dec,6)+'°';
 updateObjectObservation();
}

function renderSpectrum(available, object, cataloged){
 const host = byId('spectrum');
 const result = object ? sourceSpectrum(object,cataloged) : {};
 const status = result.status ?? 'ready';
 if (spectrumObject === object?.id && displayedSpectrum === status) return;
 displayedSpectrum = status;
 spectrumWidget?.destroy();
 spectrumWidget = undefined;
 spectrumObject = object?.id;
 host.replaceChildren();
 if (!object) return;
 const compare = document.createElement('select');
 compare.setAttribute('aria-label',t('Comparar objeto'));
 compare.add(new Option(t('Nenhum'),''));
 const others = available.filter(item => item.id !== object.id && data.radiance[item.id]?.some(Number.isFinite));
 for (const item of others) compare.add(new Option(item.id,item.id));
 const chart = document.createElement('div');
 const tools = document.createElement('div');
 tools.className = 'object-chart-tools';
 const label = document.createElement('label');
 label.append(t('Comparar objeto'),compare);
 compare.disabled = !others.length;
 const band = document.createElement('input');
 band.type = 'range';
 band.id = 'spectral-channel';
 band.min = 1;
 band.max = 102;
 band.value = activeChannel;
 band.oninput = () => chooseImageChannel(Number(band.value));
 const bandLabel = document.createElement('label');
 bandLabel.append(t('Ver faixa no mapa'),band);
 const help = document.createElement('details');
 help.innerHTML = t('<summary>Como ler o gráfico</summary><p>Da esquerda para a direita, o comprimento de onda aumenta. Quanto mais alta a linha, maior o brilho medido naquela faixa. A curva usa o mosaico SPHEREx DR1, com fundo local subtraído. O gráfico só apresenta leituras nas faixas com medição.</p>');
 const measuredBands = result.values?.filter(Number.isFinite).length ?? 0;
 const hasValues = measuredBands > 0;
 if (!hasValues) compare.disabled = true;
 tools.append(label,bandLabel,help);
 const statusLine = document.createElement('p');
 statusLine.className = 'caption spectrum-status';
 statusLine.setAttribute('role','status');
 statusLine.hidden = Boolean(hasValues);
 const empty = status === 'loading' ? t('Carregando medições do SPHEREx…') :
  status === 'error' ? t('Não foi possível carregar as medições do SPHEREx.') :
  t('Espectro SPHEREx indisponível para esta fonte.');
 if (!hasValues) statusLine.textContent = empty;
 if (status === 'error'){
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'id';
  retry.textContent = t('Tentar novamente');
  retry.onclick = () => {
   sourceSpectra.delete(object.id);
   renderSpectrum(available,object,cataloged);
  };
  statusLine.append(' ',retry);
 }
 host.append(chart,statusLine,tools);
 function chartObject(item,index){
  return {id:item.id,name:item.poc?.name ?? item.id,color:['#9d8bff','#52d6c7'][index],observations:[{
   id:'dr1',date:null,label:t('Mosaico SPHEREx DR1'),
   points:data.wavelengths.map((wavelength,i)=>({wavelength,radiance:data.radiance[item.id]?.[i] ?? null}))
  }]};
 }
 const messages = language==='en' ? {
  'chart.title':'Spectral signature',
  'chart.value':'Radiance',
  'chart.region':'5–28 μm · simulation',
  'chart.defaultRegion':'Mid-infrared',
  'chart.bands':'BANDS',
  'chart.description':'Explore the distribution of {value} at different wavelengths.',
  'chart.export':'Export CSV',
  'chart.modeLabel':'Comparison mode',
  'chart.objects':'Compare objects',
  'chart.dates':'Compare observations',
  'chart.noneSelected':'No series selected',
  'chart.selectObjects':'Select objects',
  'chart.selectDates':'Select observations',
  'chart.object':'Object',
  'chart.searchLabel':'Search for an object on this page',
  'chart.searchPlaceholder':'Search names or IDs on this page',
  'chart.done':'Done',
  'chart.inspect':'Hover over the chart to inspect a point',
  'chart.plotLabel':'Spectrum of {names}. X axis: wavelength in micrometers. Y axis: {value} in {unit}.',
  'chart.noObject':'no object',
  'chart.wavelength':'Wavelength (μm)',
  'chart.empty':hasValues ? 'No data in this range. Select a series or widen the range.' : empty,
  'chart.noData':'No data',
  'chart.unit':'{value} in {unit}',
  'chart.range':'Wavelength range',
  'chart.restoreLabel':'Restore full range',
  'chart.restore':'Reset',
  'chart.minimum':'Minimum',
  'chart.maximum':'Maximum',
  'chart.maximumLabel':'Maximum wavelength',
  'chart.drag':'Drag to explore a wavelength range',
  'chart.first':'Showing the first available observation for each selected object.',
  'chart.comparing':'Comparing observations of {name}.',
  'chart.visible':'{count} visible points',
  'chart.csv.series':'series',
  'chart.csv.observation':'observation',
  'chart.csv.wavelength':'wavelength_um',
  'chart.csv.filename':'spectra.csv'
 } : undefined;
 const props = () => ({
  locale,messages,bandCount:measuredBands,spectralRegion:t('0,75–5 µm · mosaico DR1'),
  objects:[object,...others.filter(item=>item.id===compare.value)].map(chartObject)
 });
 spectrumWidget = window.mountEyelidSpectrum(chart,props());
 const theme = document.createElement('link');
 theme.rel = 'stylesheet';
 theme.href = './object-spectrum.css';
 chart.shadowRoot.append(theme);
 chart.classList.toggle('spectrum-without-measurements',!hasValues);
 compare.onchange = () => spectrumWidget.update(props());
}


// All sources use the same sections. Their interpretation depends on the
// evidence available for the selected source.
function renderSourceOverview(id, {title, summary, identification, infrared, technical}){
 const host = byId('overview');
 const matrix = byId('candidate-technical');
 const expanded = new Set(host.dataset.source === id
  ? [...host.querySelectorAll('details[open]')].map(section => section.dataset.objectSection) : []);
 const content = `<div class="hero"><h2>${title}</h2>${summary}</div>
  <details class="evidence" data-object-section="identification"><summary>${t('Identificação')}</summary>${identification}</details>
  <details class="evidence" data-object-section="infrared"><summary>${t('Evidências no infravermelho')}</summary>${infrared}</details>
  <details class="evidence" data-object-section="technical"><summary>${t('Dados técnicos')}</summary>${technical}</details>`;
 if (host.dataset.source === id && host.eyelidMarkup === content) return;
 host.dataset.source = id;
 host.eyelidMarkup = content;
 host.innerHTML = content;
 host.querySelector('[data-object-section=technical]').append(matrix);
 for (const section of host.querySelectorAll('details[data-section]')){
  section.open = expanded.has(section.dataset.objectSection);
 }
}
