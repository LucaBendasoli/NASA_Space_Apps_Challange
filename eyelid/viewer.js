const nativeZoomLimit = 3/60;
const monoDetailZoom = 5/60;
const openingQuery=new URLSearchParams(location.search);
const openingRa=Number(openingQuery.get('ra')),openingDec=Number(openingQuery.get('dec'));
const openingTarget=openingQuery.has('ra')&&openingQuery.has('dec')&&
 Number.isFinite(openingRa)&&Number.isFinite(openingDec)&&openingRa>=0&&openingRa<=360&&Math.abs(openingDec)<=90?
 [openingRa,openingDec]:null;
const openingBand=Number(openingQuery.get('canal'));
const initialBand=Number.isInteger(openingBand)&&openingBand>=1&&openingBand<=102?openingBand:63;
function queryFor(area) {
  return new URLSearchParams({
   ra:area.ra.toFixed(3), dec:area.dec.toFixed(3),
   size:Math.min(1,Math.max(.02,area.size*1.09)).toFixed(2)
  });
 }
function initializeExposureViewer(){
 const date=byId('observation-date'), band=byId('image-channel'), img=byId('sky-image');
 const dateOptions=byId('date-options'), datePlaylist=byId('date-playlist');
 const omittedDates=new Set();
 let dateOptionsKey='', resumeDates=false;
 const timeButton=byId('date-play'), bandButton=byId('band-play');
 const available=Object.keys(data.bands).map(Number).sort((a,b)=>a-b);
 const chosen=new Set(available), controls=new Map();
 const base='observacoes/'+regionKey+'/';
 let collection={mosaics:{},dates:{}}, timer=null, running='', loadError=false;
 const playlistStatus=byId('playlist-status');
 let preparation, playbackView, renderedEpoch;
 let viewport, remoteDates={}, historyCoverage, datesKey='', lastSearch='', lastGaia='', remoteRequest, gaiaRequest, searchTimer;
 let previewToken=0, previewPath;
 const epochPreview=byId('epoch-preview');
 let archiveStatus='', presentedFrame, requestedDate=/^\d{4}-\d{2}-\d{2}$/.test(openingQuery.get('data')??'')?openingQuery.get('data'):'';
 let monoAnchor, monoAttempt, monoDetail, monoRequest, monoStatus='';
 let rgbGeneration=0, rgbChannels, rgbMosaicLabel, rgbDetailKey, rgbDetailRequest, rgbTimer;
 const mode=byId('image-mode'), rgbControls=byId('rgb-controls'), surveyPicker=byId('image-source');
 const comparing=()=>surveyPicker.value!=='spherex';
 let comparisonController, comparisonTarget, comparisonShown;
 const rgbSelectors=['red','green','blue'].map(color=>byId('rgb-'+color));
 const colorMode=()=>mode.value==='rgb';
 const resolutionStatus=byId('resolution-status');
 const closeZoom=()=>viewport&&viewport.size<=nativeZoomLimit;
 const tiledView=()=>viewport&&viewport.size>.25;
 const dateQuery=()=>{
  if(tiledView()){
   const size=Math.min(20,Math.ceil(viewport.size*1.2*2)/2);
   const step=size/16;
   const snap=value=>Math.round(value/step)*step;
   return new URLSearchParams({ra:((snap(viewport.ra)+360)%360).toFixed(5),
     dec:Math.max(-90,Math.min(90,snap(viewport.dec))).toFixed(5),size,channel:numeric(),tiles:1});
  }
  const size=viewport.size<=.10?.12:viewport.size<=.20?.24:.32;
  const step=size===.12?.005:size===.24?.015:.025;
  const snap=value=>Math.round(value/step)*step;
  const ra=(snap(viewport.ra)+360)%360;
  return new URLSearchParams({
   ra:ra.toFixed(5),dec:snap(viewport.dec).toFixed(5),size,channel:numeric(),aligned:1
  });
 };
 const searchKey=()=>{
  if(!viewport)return '';
  const next=dateQuery();
  if(tiledView()||!datesKey||!historyCoverage)return next.toString();
  const current=new URLSearchParams(datesKey);
  const coverage=historyCoverage[numeric()];
  const east=((viewport.ra-Number(current.get('ra'))+540)%360-180)*Math.cos(viewport.dec*Math.PI/180);
  const north=viewport.dec-Number(current.get('dec'));
  const radius=coverage?coverage.width*coverage.scale/7200:0;
  if(Math.max(Math.abs(east),Math.abs(north))+viewport.size/2<radius)return datesKey;
  if(coverage&&next.get('size')===current.get('size')&&next.get('ra')===current.get('ra')&&
   next.get('dec')===current.get('dec'))return datesKey;
  return next.toString();
 };
 const nativeMode=()=>!comparing()&&!colorMode()&&viewport&&viewport.size<=monoDetailZoom&&!date.value&&!running;
 function nearMonoAnchor(anchor,margin){
  if(!anchor||anchor.channel!==numeric())return false;
  const east=((viewport.ra-anchor.ra+540)%360-180)*Math.cos(viewport.dec*Math.PI/180);
  return Math.hypot(east,viewport.dec-anchor.dec)<margin;
 }
 const detailCoversView=()=>nearMonoAnchor(monoAnchor,Math.max(.008,.055-viewport.size/2));
 function clearMonoDetail(){
  monoRequest?.abort();
  monoRequest=monoAnchor=monoAttempt=monoDetail=undefined;
  monoStatus='';
 }
 async function scheduleMonoDetail(){
  if(comparing())return;
  if(!nativeMode()){
   if(monoAttempt||monoAnchor){clearMonoDetail();refresh()}
   return;
  }
  if(monoDetail&&!detailCoversView()){
   monoDetail=monoAnchor=undefined;
   refresh();
  }
  if(monoRequest){
   if(nearMonoAnchor(monoAttempt,.045))return;
   monoRequest.abort();
  }else if(nearMonoAnchor(monoAttempt,.012))return;
  const anchor={ra:viewport.ra,dec:viewport.dec,channel:numeric()};
  monoAttempt=anchor;
  const query=new URLSearchParams({
   ra:anchor.ra.toFixed(5),dec:anchor.dec.toFixed(5),size:.12,channel:anchor.channel
  });
  const controller=new AbortController();
  monoRequest=controller;
  const {signal}=controller;
  const timeout=setTimeout(()=>{
   if(monoRequest!==controller)return;
   monoStatus='IRSA demorou a responder';
   monoRequest=undefined;
   controller.abort();
   refresh();
   if(!nearMonoAnchor(anchor,.012))scheduleMonoDetail();
  },45000);
  monoStatus='buscando exposição original';
  refresh();
  try{
   const frame=await fetch('api/native-detail?'+query,{signal}).then(readArchive);
   if(signal.aborted)return;
   if(frame&&nearMonoAnchor(anchor,Math.max(.008,.055-viewport.size/2))){
    monoDetail=frame;
    monoAnchor=anchor;
   }
   monoStatus=frame?'':'sem exposição disponível';
  }catch{
   if(signal.aborted)return;
   monoStatus='consulta ao IRSA indisponível';
  }finally{
   clearTimeout(timeout);
   if(monoRequest===controller)monoRequest=undefined;
  }
  if(signal.aborted)return;
  refresh();
  if(!nearMonoAnchor(anchor,.012))scheduleMonoDetail();
 }
 function updateEpochPreview(frame){
  const path=frame?.preview;
  if(previewPath===path)return;
  previewPath=path;
  const token=++previewToken;
  if(!path){epochPreview.hidden=true;return}
  const pending=new Image();
  pending.src=path;
  pending.decode().then(()=>{
   if(token!==previewToken)return;
   byId('epoch-preview-image').src=path;
   byId('epoch-preview-caption').textContent=dayLabel(frame.utc.slice(0,10))+' · recorte SPHEREx';
   epochPreview.hidden=false;
  }).catch(()=>{
   if(token===previewToken)epochPreview.hidden=true;
  });
 }
 function showEpoch(epoch){
  if(epoch!==renderedEpoch){renderedEpoch=epoch;updateGaiaEpoch(epoch)}
 }
 const dates=()=>viewport&&datesKey===searchKey()&&Object.keys(remoteDates).length?remoteDates:
  !viewport||viewport.nearPrepared?collection.dates:{};
 const datedPath=frame=>frame?.grid??frame?.fits??(frame?.file?base+frame.file:null);
 const resetDates=()=>{
  date.length=1;
  for(const day of Object.keys(dates()).sort()){
   if(dates()[day][numeric()])date.add(new Option(dayLabel(day),day));
  }
  date.value=[...date.options].some(option=>option.value===requestedDate)?requestedDate:'';
  date.disabled=date.length===1;
  const days=Array.from(date.options).slice(1).map(option=>option.value);
  datePlaylist.hidden=days.length<2;
  const key=days.join(',');
  if(key!==dateOptionsKey){
   dateOptionsKey=key;
   dateOptions.replaceChildren(...days.map(day=>{
    const label=document.createElement('label');
    const input=document.createElement('input');
    input.type='checkbox';
    input.checked=!omittedDates.has(day);
    input.onchange=()=>{
     if(input.checked)omittedDates.delete(day);
     else omittedDates.add(day);
     if(running==='date')stop();
     refresh();
    };
    label.append(input,dayLabel(day));
    return label;
   }));
  }
 };
 const decimals=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3});
 const channelLabel=c=>'Canal '+c+' · '+decimals.format(data.wavelengths[c-1])+' µm';
 const dayLabel=d=>d.split('-').reverse().join('/');
 const numeric=()=>Number(band.value);
 for(let c=1;c<=102;c++){
  const option=new Option(channelLabel(c)+(available.includes(c)?'':' · sem dados'),c);
  band.add(option);
  if(!available.includes(c))continue;
  const label=document.createElement('label'), input=document.createElement('input');
  input.type='checkbox';input.checked=true;input.value=c;
  label.append(input,document.createTextNode(' '+c));
  label.title=channelLabel(c);
  input.setAttribute('aria-label',channelLabel(c));
  input.onchange=()=>{if(running==='band')stop();if(input.checked)chosen.add(c);else chosen.delete(c);refresh()};
  controls.set(c,input);byId('playlist').append(label);
 }
 band.value=initialBand;
 for(const [index,picker] of rgbSelectors.entries()){
  for(const c of available)picker.add(new Option(channelLabel(c),c));
  picker.value=[86,42,12][index];
  picker.onchange=renderRGB;
 }
 const contrast=byId('image-contrast'), invert=byId('image-invert'), enhance=byId('image-enhance');
 function applyAppearance(){
  aladin?.appearance({contrast:Number(contrast.value)/100,inverted:invert.checked,enhance:enhance.checked});
 }
 for(const input of [contrast,invert,enhance])input.addEventListener('input',applyAppearance);
 byId('image-reset').onclick=()=>{
  contrast.value=0;
  invert.checked=enhance.checked=false;
  applyAppearance();
 };
 document.addEventListener('atlas-aladin-ready',()=>{
  mode.disabled=surveyPicker.disabled=byId('appearance-controls').disabled=false;
  applyAppearance();
 });
 function syncImageControls(){
  const other=comparing();
  document.querySelector('.display-mode').hidden=other;
  rgbControls.hidden=other||!colorMode();
  for(const control of document.querySelectorAll('.mono-control'))control.hidden=other||colorMode();
  byId('playlist-summary').closest('details').hidden=other||colorMode();
  byId('date-status').hidden=other||colorMode();
  if(other||colorMode()){byId('exposure-focus').hidden=true;updateEpochPreview(null)}
 }
 async function updateComparison(){
  if(!comparing()||!aladinActive)return;
  const requested=surveyPicker.value;
  const target=requested==='optical'?await aladin.opticalSurvey():'wise';
  if(surveyPicker.value!==requested||comparisonTarget===target)return;
  comparisonController?.abort();
  const controller=new AbortController();
  const {signal}=controller;
  comparisonController=controller;
  comparisonTarget=target;
  resolutionStatus.textContent=comparisonShown?comparisonShown+' · carregando outra imagem…':'Carregando imagem de comparação…';
  try{
   let survey=await aladin.showComparison(target,signal);
   if(!survey&&!signal.aborted&&target==='sdss')survey=await aladin.showComparison('dss',signal);
   if(signal.aborted)return;
   if(!survey){
    const previous=comparisonShown;
    if(!previous){
     surveyPicker.value='spherex';
     surveyPicker.onchange();
     if(!colorMode())resolutionStatus.textContent='SPHEREx · imagem de comparação indisponível';
    }else resolutionStatus.textContent=previous+' · outra imagem indisponível';
    return;
   }
   comparisonShown=survey.label;
   resolutionStatus.textContent=survey.label+' · grade '+survey.scale+'″/pixel';
   byId('frame-status').textContent=survey.label+' · mosaico HiPS.';
   const origin=byId('frame-origin');
   origin.hidden=false;
   origin.href=survey.url+'/properties';
   origin.textContent='Sobre esta imagem';
  }catch(error){
   if(!signal.aborted)resolutionStatus.textContent='Imagem de comparação indisponível';
  }
 }
 document.addEventListener('atlas-optical-coverage',()=>{if(surveyPicker.value==='optical')updateComparison()});
 surveyPicker.onchange=()=>{
  stop();
  comparisonController?.abort();
  comparisonTarget=undefined;
  syncImageControls();
  if(comparing()){
   monoRequest?.abort();
   monoRequest=undefined;
   monoAttempt=monoAnchor;
   clearTimeout(rgbTimer);
   rgbDetailRequest?.abort();
   rgbGeneration++;
   showEpoch(null);
   resolutionStatus.textContent='Carregando imagem de comparação…';
   updateComparison();
   return;
  }
  aladin.clearComparison();
  comparisonShown=undefined;
  presentedFrame=undefined;
  resolutionStatus.textContent='';
  byId('frame-origin').textContent='Abrir FITS original';
  byId('frame-origin').hidden=true;
  if(colorMode())renderRGB();
  else{refresh();scheduleMonoDetail();scheduleSearch()}
 };
 mode.onchange=()=>{
  stop();
  syncImageControls();
  if(colorMode()){
   clearMonoDetail();
   showEpoch(null);
   byId('frame-origin').hidden=true;
   byId('frame-status').textContent='Falsa cor · três faixas do mosaico SPHEREx DR1, combinadas em vermelho, verde e azul.';
   renderRGB();
  }else{
   rgbGeneration++;
   clearRGBDetail();
   presentedFrame=undefined;
   resolutionStatus.textContent='';
   refresh();
   scheduleMonoDetail();
   scheduleSearch();
  }
 };
 function clearRGBDetail(){
  clearTimeout(rgbTimer);
  rgbDetailRequest?.abort();
  rgbDetailKey=undefined;
  aladin?.clearRGBDetail();
 }
 function scheduleRGBDetail(){
  if(comparing()||!colorMode()||!rgbChannels)return;
  if(!closeZoom()){
   if(rgbDetailKey){
    clearRGBDetail();
    byId('frame-status').textContent='Falsa cor · mosaico SPHEREx DR1.';
   }
   resolutionStatus.textContent=rgbMosaicLabel;
   return;
  }
  const ra=viewport.ra.toFixed(2), dec=viewport.dec.toFixed(2);
  const query=new URLSearchParams({ra,dec,size:.08,rgb:rgbChannels.join(',')}).toString();
  if(rgbDetailKey===query)return;
  clearRGBDetail();
  rgbDetailKey=query;
  resolutionStatus.textContent=rgbMosaicLabel+' · buscando exposições';
  byId('frame-status').textContent='Falsa cor · mosaico SPHEREx DR1.';
  rgbTimer=setTimeout(async()=>{
   const controller=new AbortController();
   rgbDetailRequest=controller;
   const {signal}=controller;
   try{
    const frame=await fetch('api/rgb-detail?'+query,{signal}).then(readArchive);
    if(signal.aborted)return;
    if(frame&&await aladin.showRGBDetail(frame,signal)){
     const scale=fmt(frame.pixelScale,2);
     resolutionStatus.textContent='RGB de exposições · '+scale+'″/pixel';
     const dates=frame.dates.map(dayLabel);
     byId('frame-status').textContent=`Exposições SPHEREx · R ${dates[0]} · G ${dates[1]} · B ${dates[2]}`;
     return;
    }
    if(!signal.aborted)resolutionStatus.textContent=rgbMosaicLabel+(frame?' · recorte indisponível':' · sem exposições para as três faixas');
   }catch{
    if(!signal.aborted)resolutionStatus.textContent=rgbMosaicLabel+' · exposições indisponíveis';
   }
  },420);
 }
 async function renderRGB(){
  if(comparing()||!aladinActive||!colorMode())return;
  clearRGBDetail();
  rgbChannels=null;
  const generation=++rgbGeneration;
  const colors=rgbSelectors.map(picker=>Number(picker.value));
  resolutionStatus.textContent='Preparando falsa cor…';
  const ready=await aladin.showRGB(colors);
  if(generation!==rgbGeneration||!colorMode())return;
  if(!ready){
   resolutionStatus.textContent='Composição indisponível. A última imagem continua visível.';
   return;
  }
  rgbChannels=colors;
  rgbMosaicLabel=`Falsa cor · R ${colors[0]} · G ${colors[1]} · B ${colors[2]} · mosaico 12,9″/pixel`;
  byId('frame-status').textContent='Falsa cor · três faixas do mosaico SPHEREx DR1, combinadas em vermelho, verde e azul.';
  scheduleRGBDetail();
 }
 function scheduleSearch(){
  clearTimeout(searchTimer);
  searchTimer=setTimeout(searchViewport,420);
 }
 async function searchViewport(){
  if(!viewport)return;
  const status=byId('navigation-status');
  const query=queryFor(viewport);
  const key=available.includes(numeric())?searchKey():'';
  const gaiaKey=!viewport.prepared&&viewport.size<=0.75&&byId('gaia-toggle').checked?query.toString():'';
  if(gaiaKey!==lastGaia){
   lastGaia=gaiaKey;
   gaiaRequest?.abort();
   const cached=gaiaFields.get(gaiaKey);
   if(cached){
    rememberGaiaField(gaiaKey,cached);
    showGaiaCount(cached);
   }else if(gaiaKey){
    gaiaRequest=new AbortController();
    const signal=gaiaRequest.signal;
    byId('gaia-status').textContent='Consultando Gaia DR3…';
    fetch('api/gaia?'+gaiaKey,{signal}).then(readArchive).then(sources=>{
     if(signal.aborted)return;
     rememberGaiaField(gaiaKey,sources);
     showGaiaCount(sources);
    }).catch(()=>{if(!signal.aborted){lastGaia='';byId('gaia-status').textContent='Consulta Gaia indisponível.'}});
   }else byId('gaia-status').textContent='';
  }
  if(comparing()||colorMode())return;
  if(key===lastSearch){
   resetDates();
   if(!key){
    archiveStatus='';
    status.textContent='';
   }
   refresh();
   return;
  }
  lastSearch=key;
  remoteRequest?.abort();
  remoteDates={};
  historyCoverage=undefined;
  datesKey='';
  archiveStatus=key?'loading':'';
  resetDates();
  if(!requestedDate||!presentedFrame?.imagePath)refresh();
  if(!key){
   status.textContent='';
   return;
  }
  remoteRequest=new AbortController();
  const signal=remoteRequest.signal;
  status.textContent='Consultando exposições e calibrando os canais no IRSA…';
  try{
   const result=await fetch((tiledView()?'api/temporal-tiles?':'api/exposures?')+key,{signal}).then(readArchive);
   if(signal.aborted||searchKey()!==key)return;
   remoteDates=result.dates;
   historyCoverage=result.coverage;
   datesKey=key;
   archiveStatus='';
   resetDates();
   refresh();
   status.textContent=[viewport.size*1.2>20?'Histórico limitado ao campo central de até 20°.':'',
    result.partial?'Cobertura parcial. Algumas exposições do IRSA estão indisponíveis.':
    result.failures?'Exposições do IRSA indisponíveis: '+result.failures+'.':''].filter(Boolean).join(' ');
   if(resumeDates&&chronologicalLoop().length>=2){resumeDates=false;toggle('date')}
   else resumeDates=false;
  }catch(error){
   if(signal.aborted)return;
   lastSearch='';
   archiveStatus='error';
   refresh();
   status.textContent='Consulta IRSA indisponível. Mova o mapa ou troque de canal para tentar novamente.';
  }
 }
 async function readArchive(response){
  if(!response.ok)throw Error(response.status);
  return response.json();
 }
 document.addEventListener('atlas-coverage',event=>{
  const previous=viewport, previousHistory=searchKey();
  viewport=event.detail;
  if(surveyPicker.value==='optical')updateComparison();
  scheduleRGBDetail();
  if(playbackView&&(running==='date'?searchKey():queryFor(viewport).toString())!==playbackView){
   resumeDates=running==='date';
   stop();
   if(resumeDates)playlistStatus.textContent='Preparando as datas da nova área…';
  }
  if(!running){
   scheduleMonoDetail();
   const changedHistory=previousHistory!==searchKey();
   if(changedHistory)resetDates();
   if((!changedHistory||!requestedDate||!presentedFrame?.imagePath)&&(changedHistory||previous&&((previous.size<=.25)!==(viewport.size<=.25)||(previous.size>.75)!==(viewport.size>.75))))refresh();
   scheduleSearch();
  }
 });
 document.addEventListener('atlas-gaia-toggle',scheduleSearch);
 function spectralLoop(){
  const frames=date.value?dates()[date.value]:collection.mosaics;
  return [...chosen].filter(c=>frames?.[c]).sort((a,b)=>a-b);
 }
 function chronologicalLoop(){
  return Object.keys(dates()).filter(d=>dates()[d][numeric()]&&!omittedDates.has(d)).sort();
 }
 function refresh(){
  if(comparing()||colorMode())return;
  const c=numeric(), day=date.value, frame=dates()[day]?.[c], native=nativeMode()&&detailCoversView()?monoDetail:null;
  const path=day?frame?.file:collection.mosaics[c];
  syncSpectrumChannel(c);
  byId('sky').classList.toggle('no-frame',!path);
  if(path){
   img.src=base+path;img.alt='Imagem SPHEREx · '+channelLabel(c);img.hidden=false;
  }else{
   img.removeAttribute('src');img.hidden=true;
  }
  const display=frame??native;
  const displayedChannel=native?.channel??(!day&&c===51?50:!day&&c===52?53:c);
  const bandLabel=displayedChannel===c?'':` · canal ${displayedChannel} (pedido ${c})`;
  const epoch=display?.utc ?? (day ? day+'T00:00:00Z' : null);
  const imagePath=datedPath(display);
  if(!display||!aladinActive)showEpoch(epoch);
  const label=native?`Exposição SPHEREx · ${dayLabel(native.utc.slice(0,10))}${native.pixelScale?' · '+decimals.format(native.pixelScale)+'″/pixel':''}${bandLabel}`:
   !day?'Mosaico SPHEREx'+(viewport?.size<=.25?' · 12,9″/pixel':'')+bandLabel+
    (nativeMode()&&monoStatus?' · '+monoStatus:''):frame?`SPHEREx · ${dayLabel(day)} · canal ${c}${frame.source==='local'?' · acervo local':''}${frame.tiles?' · '+frame.tiles.length+' blocos':frame.expanded?' · recorte alinhado · '+decimals.format(frame.pixelScale)+'″/pixel':''}`:'';
  if(presentedFrame?.imagePath!==imagePath||presentedFrame?.label!==label){
   presentedFrame={imagePath,label};
   if(!display)resolutionStatus.textContent=label;
   else if(frame)resolutionStatus.textContent='Carregando exposição · '+dayLabel(day);
  }
  const wideExposure=Boolean(frame&&!frame.tiles&&viewport?.size>.75);
  const focus=byId('exposure-focus');
  focus.hidden=!frame||Boolean(frame.tiles)||!(viewport?.size>.075);
  if(!wideExposure||!frame.preview)updateEpochPreview(null);
  const presentation=presentedFrame;
  document.dispatchEvent(new CustomEvent('atlas-frame',{detail:{datedPath:imagePath,channel:displayedChannel,rendered:success=>{
   if(!display||presentedFrame!==presentation)return;
   if(success){showEpoch(epoch);if(wideExposure)updateEpochPreview(frame)}
   resolutionStatus.textContent=success?label:'Exposição original indisponível';
   if(success&&native)byId('frame-status').textContent=label;
  }}}));
  const dateCount=chronologicalLoop().length;
  const counts=new Map();
  for(const channels of Object.values(dates())){
   for(const channel of Object.keys(channels))counts.set(Number(channel),(counts.get(Number(channel))??0)+1);
  }
  const alternative=[...counts].filter(([channel,count])=>channel!==c&&count>=2)
   .sort(([a],[b])=>Math.abs(a-c)-Math.abs(b-c))[0]?.[0];
  byId('date-status').textContent=frame?.tiles?'Áreas sem cobertura na data mostram o mosaico de fundo.':wideExposure?'A data se aplica ao recorte marcado. O restante mostra o mosaico.':
   day||!viewport||archiveStatus||dateCount>=2?'':[
   dateCount===1?'Uma data confirmada neste canal.':'Nenhuma data confirmada neste canal.',
   alternative?'O canal '+alternative+' tem datas para comparar.':'Experimente outra faixa.'
  ].join(' ');
  const source=byId('frame-origin');
  source.hidden=!display;
  if(display){source.href=display.url;source.textContent='Abrir FITS original'}
  const status=byId('frame-status');
  if(loadError)status.textContent='Imagens locais indisponíveis. Recarregue para tentar novamente.';
  else if(!available.includes(c))status.textContent='O canal '+c+' não tem dados no SPHEREx DR1.';
  else if(frame)status.textContent=dayLabel(day)+' às '+frame.utc.slice(11,19)+' UTC · '+decimals.format(frame.wave)+' µm no centro do campo. O canal nominal é '+c+'.';
  else if(day)status.textContent='Sem exposição neste canal para '+dayLabel(day)+'. Selecione um canal disponível nessa data.';
  else status.textContent='Mosaico SPHEREx DR1 · observações combinadas.'+(viewport&&date.length===1?' Nenhuma data confirmada para este canal.':'');
  for(const opt of band.options){
   const k=Number(opt.value);
   opt.textContent=channelLabel(k)+(!available.includes(k)?' · sem dados':day&&!dates()[day]?.[k]?' · indisponível nesta data':'');
  }
  timeButton.disabled=dateCount<2;
  timeButton.title=timeButton.disabled?'Este canal tem menos de duas datas disponíveis':'Reproduzir datas mantendo o canal';
  bandButton.disabled=spectralLoop().length<2;
  byId('playlist-summary').textContent='Selecionar canais do loop · '+chosen.size+' selecionados';
  if((running==='date'&&timeButton.disabled)||(running==='band'&&bandButton.disabled))stop();
 }
 function stop(){
  preparation?.abort();preparation=null;
  playbackView=null;
  clearTimeout(timer);timer=null;running='';
  playlistStatus.textContent='';
  timeButton.textContent='▶ Datas';bandButton.textContent='▶ Canais';
  timeButton.setAttribute('aria-pressed','false');bandButton.setAttribute('aria-pressed','false');
 }
 async function advance(axis,values,signal,notBefore=0){
  const select=axis==='date'?date:band, current=axis==='date'?date.value:numeric();
  const next=values[(values.indexOf(current)+1)%values.length];
  const frame=dates()[axis==='date'?next:date.value]?.[axis==='date'?numeric():next];
  if(signal?.aborted)return false;
  if(colorMode())return false;
  if(aladinActive&&!await aladin.show(axis==='date'?numeric():next,datedPath(frame),signal,notBefore))return false;
  if(signal?.aborted)return false;
  select.value=next;
  if(axis==='date')requestedDate=next;
  resetDates();
  refresh();
  return true;
 }
 async function prepareBands(values,signal,report){
  let urls;
  if(date.value){
   urls=values.flatMap(c=>{
    const frame=dates()[date.value][c];
    if(frame.tiles)return frame.tiles;
    if(frame.fits)return frame.fits;
    return base+frame.file.replace(/\.png$/,aladinActive?'.fits':'.png');
   });
  }else if(aladinActive){
   urls=aladin.tilesFor(values);
   for(let attempt=0;!urls.length&&attempt<12&&!signal.aborted;attempt++){
    await new Promise(resolve=>setTimeout(resolve,200));
    urls=aladin.tilesFor(values);
   }
  }else{
   urls=values.map(c=>base+collection.mosaics[c]);
  }
  if(!urls?.length)throw Error('Sem blocos do mapa');
  let cached=new Set();
  if(aladinActive&&window.caches){
   try{
    const cache=await caches.open('eyelid-spherex-dr1-20261026');
    cached=new Set((await cache.keys()).map(request=>request.url));
   }catch{}
  }
  if(signal.aborted)return 0;
  const blocksPerChannel=urls.length/values.length;
  const remaining=new Map(values.map(channel=>[channel,0]));
  const ready=new Set(), unavailable=new Set();
  const pending=[];
  for(const [index,url] of urls.entries()){
   if(cached.has(new URL(url,location.href).href))continue;
   const channel=values[Math.floor(index/blocksPerChannel)];
   remaining.set(channel,remaining.get(channel)+1);
   pending.push({channel,url});
  }
  for(const [channel,count] of remaining)if(!count)ready.add(channel);
  let next=0,done=urls.length-pending.length;
  const notify=()=>report({ready,unavailable,done,total:urls.length});
  notify();
  await Promise.all(Array.from({length:Math.min(16,pending.length)},async()=>{
   while(next<pending.length&&!signal.aborted){
    const {channel,url}=pending[next++];
    try{
     const response=await fetch(url,{signal});
     if(!response.ok)throw Error(response.status);
     await response.arrayBuffer();
    }catch(error){if(!signal.aborted)unavailable.add(channel);}
    if(signal.aborted)return;
    done++;
    const count=remaining.get(channel)-1;
    remaining.set(channel,count);
    if(!count&&!unavailable.has(channel))ready.add(channel);
    notify();
   }
  }));
 }

 async function toggle(axis){
  if(running===axis){stop();refresh();scheduleMonoDetail();scheduleSearch();return}
  stop();running=axis;
  clearMonoDetail();
  const button=axis==='date'?timeButton:bandButton;
  button.setAttribute('aria-pressed','true');
  const values=axis==='date'?chronologicalLoop():spectralLoop();
  if(values.length<2){stop();return}
  if(axis==='band'){
   if(!date.value)refresh();
   button.textContent='Cancelar preparo';
   playlistStatus.textContent='Preparando imagens dos canais…';
   clearTimeout(searchTimer);
   playbackView=viewport&&queryFor(viewport).toString();
   preparation=new AbortController();
   const {signal}=preparation;
   const nextIndex=values.indexOf(numeric())+1;
   const ordered=[...values.slice(nextIndex),...values.slice(0,nextIndex)];
   let buffering=false, switching=false;
   let state;
   function updateStatus(){
    const percent=Math.floor(state.done*100/state.total);
    let message;
    if(state.done===state.total&&!buffering){
     message=state.unavailable.size
      ?state.ready.size+' canais preparados · '+state.unavailable.size+' indisponíveis.'
      :state.ready.size+' canais preparados para esta vista.';
    }else{
     message=(buffering?'Aguardando o próximo canal':timer===null?'Preparando imagens':'Baixando próximos canais')+
      ' · '+percent+'% · '+state.ready.size+' de '+values.length+' canais';
    }
    if(playlistStatus.textContent!==message)playlistStatus.textContent=message;
   }
   async function tick(){
    if(switching||signal.aborted)return;
    const playable=ordered.filter(channel=>!state.unavailable.has(channel));
    const following=playable[(playable.indexOf(numeric())+1)%playable.length];
    const after=playable[(playable.indexOf(following)+1)%playable.length];
    buffering=!state.ready.has(following)||!state.ready.has(after);
    if(!buffering){
     switching=true;
     const success=await advance('band',playable,signal);
     switching=false;
     if(signal.aborted)return;
     if(!success){state.unavailable.add(following);state.ready.delete(following)}
     if(state.done===state.total&&state.ready.size<2){
      stop();
      playlistStatus.textContent='Menos de dois canais puderam ser exibidos.';
      return;
     }
    }
    updateStatus();
   }
   try{
    await prepareBands(ordered,signal,progress=>{
     if(signal.aborted)return;
     state=progress;
     const finished=state.done===state.total;
     if(finished&&state.ready.size<2){
      stop();
      playlistStatus.textContent='Menos de dois canais puderam ser preparados. Tente novamente.';
      return;
     }
     const available=ordered.filter(channel=>!state.unavailable.has(channel));
     const buffer=Math.min(2,available.length);
     if(timer===null&&buffer>=2&&available.slice(0,buffer).every(channel=>state.ready.has(channel))){
      button.textContent='❚❚ Pausar';
      timer=setInterval(tick,650);
      tick();
     }
     updateStatus();
    });
   }catch(error){
    if(!signal.aborted){stop();playlistStatus.textContent='O preparo falhou. Aguarde o mapa carregar e tente novamente.';}
   }
   return;
  }
  button.textContent='❚❚ Pausar';
  clearTimeout(searchTimer);
  playbackView=searchKey();
  preparation=new AbortController();
  const {signal}=preparation;
  let playable=values;
  async function tick(notBefore=0){
   if(signal.aborted)return;
   const following=playable[(playable.indexOf(date.value)+1)%playable.length];
   playlistStatus.textContent='Preparando '+dayLabel(following)+'…';
   const success=await advance('date',playable,signal,notBefore);
   if(signal.aborted)return;
   if(!success)playable=playable.filter(day=>day!==following);
   if(playable.length<2){
    stop();
    playlistStatus.textContent='Menos de duas datas puderam ser exibidas.';
    return;
   }
   playlistStatus.textContent='';
   if(aladinActive)timer=setTimeout(()=>tick(performance.now()+1100),0);
   else timer=setTimeout(tick,1100);
  }
  tick();
 }

 byId('reset-date-playlist').onclick=()=>{
  if(running==='date')stop();
  omittedDates.clear();
  dateOptionsKey='';
  resetDates();
  refresh();
 };
 timeButton.onclick=()=>{resumeDates=false;toggle('date')};bandButton.onclick=()=>toggle('band');
 date.onchange=()=>{resumeDates=false;stop();requestedDate=date.value;refresh();scheduleMonoDetail()};
 byId('exposure-focus').onclick=()=>aladin?.zoomToExposure();
 band.onchange=()=>{resumeDates=false;stop();aladin?.warmNeighbors(numeric());resetDates();refresh();scheduleMonoDetail();scheduleSearch()};
 byId('all-channels').onclick=()=>{if(running==='band')stop();for(const [c,i] of controls){chosen.add(c);i.checked=true}refresh()};
 byId('no-channels').onclick=()=>{if(running==='band')stop();for(const [c,i] of controls){chosen.delete(c);i.checked=false}refresh()};

 fetch(base+'index.json').then(r=>{if(!r.ok)throw Error(r.status);return r.json()}).then(result=>{
  collection=result;
  resetDates();
  refresh();
 }).catch(()=>{loadError=true;refresh()});
}
initializeExposureViewer();

const aladinHost=byId('aladin-sky');
let aladin, aladinFrame={channel:initialBand,datedPath:null};
let aladinActive=false;

function syncAladinPoints(){
 if(!aladinActive||!aladin)return;
 const stars=byId('gaia-toggle').checked?[...data.gaia,...remoteGaia].map(source=>{
  const [ra,dec]=gaiaPosition(source);
  return {id:source.id,ra,dec};
 }):[];
 const candidates=(byId('candidate-toggle').checked?rows:[]).filter(row=>row.id===selected||passesCandidateFilter(row))
  .map(row=>({id:row.id,ra:row.ra_icrs_deg,dec:row.dec_icrs_deg}));
 aladin.points(stars,candidates,selected);
}
const gaiaFields=new Map();
let remoteGaia=[];
function showGaiaCount(sources){
 byId('gaia-status').textContent=sources.length===500?'Gaia DR3 · 500 fontes mais brilhantes neste campo.':
  'Gaia DR3 · '+sources.length+' fontes retornadas.';
}
function rememberGaiaField(key,sources){
 gaiaFields.delete(key);
 gaiaFields.set(key,sources);
 if(gaiaFields.size>8)gaiaFields.delete(gaiaFields.keys().next().value);
 const merged=new Map();
 for(const field of gaiaFields.values()){
  for(const source of field)merged.set(source.id,source);
 }
 const active=gaiaById.get(selected);
 if(active&&!localGaiaIds.has(active.id))merged.set(active.id,active);
 setRemoteGaia([...merged.values()]);
}
function setRemoteGaia(sources){
 for(const source of remoteGaia){
  if(source.id!==selected)gaiaById.delete(source.id);
 }
 remoteGaia=sources.filter(source=>!localGaiaIds.has(source.id));
 for(const source of remoteGaia)gaiaById.set(source.id,source);
 syncAladinPoints();
}
const navigationStatus=byId('navigation-status');
async function openSkyViewer(){
 aladinHost.hidden=false;
 byId('sky').classList.add('aladin-active');
 try{
  const {createAladin}=await import('./aladin-view.js');
  aladin=await createAladin(aladinHost,data.center,aladinFrame.channel,select,()=>{
   navigationStatus.textContent='A exposição datada não pôde ser aberta. Mantivemos a última imagem disponível.';
  },area=>{
   document.dispatchEvent(new CustomEvent('atlas-coverage',{detail:area}));
  },openingTarget??data.center);
  const sharedFov=Number(openingQuery.get('fov'));
  if(openingTarget&&sharedFov>=.00001&&sharedFov<=360)aladin.setFieldOfView(sharedFov);
  aladinActive=true;
  document.dispatchEvent(new Event('atlas-aladin-ready'));
  if(navigationStatus.textContent==='Carregando mapa do céu…')navigationStatus.textContent='';
  syncMarkerOpacity();
  renderScanStatus();
  aladin.show(aladinFrame.channel,aladinFrame.datedPath).then(aladinFrame.rendered);
  syncAladinPoints();
 }catch(error){
  console.warn('Aladin Lite:',error);
  aladinHost.hidden=true;
  byId('sky').classList.remove('aladin-active');
  navigationStatus.textContent='Mapa interativo indisponível neste navegador. Exibindo o recorte SPHEREx.';
 }
}
document.addEventListener('atlas-frame',event=>{
 aladinFrame=event.detail;
 if(aladinActive){
  aladin.show(aladinFrame.channel,aladinFrame.datedPath).then(aladinFrame.rendered);
 }
});
document.addEventListener('atlas-gaia',syncAladinPoints);
document.addEventListener('atlas-selection',syncAladinPoints);

const scanButton=byId('scan-view'), scanStatus=byId('scan-status');
let scanArea, scanJob, loadingScans=true, scanError='', scanSummary='';
let nextCandidate=1;
const analyzedFields=new Map();

function offsetFrom(center,ra,dec){
 const east=((ra-center[0]+540)%360-180)*Math.cos(center[1]*Math.PI/180);
 return [east,dec-center[1]];
}
function registerField(field,key,prefix){
 if(analyzedFields.has(key))return;
 analyzedFields.set(key,field);
 for(const row of field.rows){
  const duplicate=rows.some(existing=>{
   const offset=offsetFrom([existing.ra_icrs_deg,existing.dec_icrs_deg],row.ra_icrs_deg,row.dec_icrs_deg);
   return Math.hypot(...offset)*3600<5;
  });
  if(duplicate)continue;
  const id=prefix?prefix+row.id:'A'+String(nextCandidate++).padStart(2,'0');
  data.radiance[id]=field.radiance[row.id];
  rows.push(candidateRow({...row,id}));
 }
}
for(const [key,field] of Object.entries(regions)){
 registerField(field,key,key==='campo-hercules'?'H-':key==='campo-leao'?'L-':'C03-');
}

function scanPlan(area){
 const query=queryFor(area);
 const ra=Number(query.get('ra')), dec=Number(query.get('dec'));
 const radius=Number(query.get('size'))*.72;
 const step=.09, limit=Math.ceil(radius/step);
 const radians=Math.PI/180, latitude=dec*radians;
 const cells=[];
 for(let i=-limit;i<=limit;i++){
  for(let j=-limit;j<=limit;j++){
   const east=i*step,north=j*step;
   if(Math.hypot(Math.max(0,Math.abs(east)-.045),Math.max(0,Math.abs(north)-.045))>radius)continue;
   const x=east*radians,y=north*radians;
   const denominator=Math.cos(latitude)-y*Math.sin(latitude);
   const lon=(ra+Math.atan2(x,denominator)/radians+360)%360;
   const lat=Math.atan2(Math.sin(latitude)+y*Math.cos(latitude),Math.hypot(denominator,x))/radians;
   cells.push({center:[lon,lat],distance:Math.hypot(east,north)});
  }
 }
 return cells.sort((a,b)=>a.distance-b.distance).map(cell=>cell.center);
}
function hasScan([ra,dec]){
 return [...analyzedFields.values()].some(field=>
  offsetFrom(field.center,ra,dec).every(value=>Math.abs(value)<.004)
 );
}
function renderScanStatus(){
 if(!scanArea)return;
 const plan=scanArea.size<=.75?scanPlan(scanArea):[];
 const pending=plan.filter(center=>!hasScan(center));
 aladin?.scanFootprint(scanJob?.center??null);
 scanButton.textContent=scanJob?'Parar após este recorte':'Analisar área do mapa';
 scanButton.disabled=scanJob?scanJob.stopping:loadingScans||!pending.length;
 if(scanJob){
  const {done,total,failed,found,stopping}=scanJob;
  scanStatus.textContent=(stopping?'Parando após o recorte atual':'Analisando área')+' · '+
   done+' de '+total+' recortes · '+found+' novos candidatos'+(failed?' · '+failed+' indisponíveis':'');
 }else if(loadingScans)scanStatus.textContent='Carregando áreas já analisadas…';
 else if(scanError)scanStatus.textContent=scanError;
 else if(scanSummary)scanStatus.textContent=scanSummary;
 else if(!plan.length)scanStatus.textContent='Aproxime o zoom para analisar o campo.';
 else if(!pending.length)scanStatus.textContent='Área já analisada. Os candidatos salvos aparecem no mapa.';
 else scanStatus.textContent=pending.length+' recortes de 6′ × 6′ para analisar. Os resultados aparecem conforme ficam prontos.';
}
document.addEventListener('atlas-coverage',event=>{
 scanArea=event.detail;
 scanError='';
 scanSummary='';
 renderScanStatus();
});
fetch('api/scans',{cache:'no-store'}).then(response=>{
 if(!response.ok)throw Error(response.status);
 return response.json();
}).then(fields=>{
 for(const field of fields)registerField(field,field.key);
 render();
}).catch(()=>{
 scanError='Não foi possível carregar as análises salvas.';
}).finally(()=>{
 loadingScans=false;
 renderScanStatus();
});

scanButton.onclick=async()=>{
 if(!scanArea||scanButton.disabled)return;
 if(scanJob){
  scanJob.stopping=true;
  renderScanStatus();
  return;
 }
 const pending=scanPlan(scanArea).filter(center=>!hasScan(center));
 scanError='';
 scanSummary='';
 const job={total:pending.length,done:0,failed:0,found:0,stopping:false,center:null};
 scanJob=job;
 try{
  for(const center of pending){
   if(job.stopping)break;
   job.center=center;
   renderScanStatus();
   const [ra,dec]=center.map(value=>value.toFixed(4));
   try{
    const response=await fetch('api/scan?'+new URLSearchParams({ra,dec,size:.1}));
    if(!response.ok)throw Error(response.status);
    const field=await response.json();
    const previous=rows.length;
    registerField(field,field.key);
    job.found+=rows.length-previous;
    render();
   }catch(error){job.failed++;}
   job.done++;
   renderScanStatus();
  }
 }finally{
  scanJob=undefined;
  scanSummary=(job.stopping?'Análise interrompida':'Análise concluída')+' · '+
   (job.done-job.failed)+' de '+job.total+' recortes concluídos · '+job.found+' novos candidatos'+
   (job.failed?' · '+job.failed+' recortes indisponíveis. Você pode tentar novamente.':'.');
  renderScanStatus();
 }
};

const markerOpacityControls=['gaia','candidate'].map(layer=>byId(layer+'-opacity'));
function syncMarkerOpacity(){
 const values=markerOpacityControls.map(input=>{
  byId(input.id+'-value').textContent=input.value+'%';
  const opacity=Number(input.value)/100;
  byId('sky').style.setProperty('--'+input.id,opacity);
  return opacity;
 });
 aladin?.markerOpacity(...values);
}
for(const input of markerOpacityControls){
 try{
  const saved=localStorage.getItem('eyelid:'+input.id);
  if(saved!==null)input.value=saved;
 }catch{}
 input.addEventListener('input',syncMarkerOpacity);
 input.addEventListener('change',()=>{
  try{localStorage.setItem('eyelid:'+input.id,input.value)}catch{}
 });
}
syncMarkerOpacity();

byId('candidate-toggle').onchange=event=>{
 byId('sky').classList.toggle('hide-candidates',!event.target.checked);
 syncAladinPoints();
};
byId('map-candidates').onchange=event=>{
 const row=rows.find(candidate=>candidate.id===event.target.value);
 if(!row){select(undefined);return}
 focusCandidate(row);
};
function focusCandidate(row){
 aladin?.focus(row.ra_icrs_deg,row.dec_icrs_deg);
 select(row.id);
}
openSkyViewer();


const layerSettings=document.querySelector('.map-settings');
document.addEventListener('pointerdown',event=>{
 if(layerSettings.open&&!layerSettings.contains(event.target))layerSettings.open=false;
});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&layerSettings.open){
  layerSettings.open=false;
  layerSettings.querySelector('summary').focus();
 }
});

const imageAdjustments=document.querySelector('.image-adjustments');
document.addEventListener('pointerdown',event=>{
 if(imageAdjustments.open&&!imageAdjustments.contains(event.target))imageAdjustments.open=false;
});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&imageAdjustments.open){
  imageAdjustments.open=false;
  imageAdjustments.querySelector('summary').focus();
 }
});
