const gaiaById=new Map(data.gaia.map(source=>[source.id,source]));
const localGaiaIds=new Set(gaiaById.keys());
const gaiaMarks=byId('gaia-marks');
const gaiaNodes=new Map();
const radians=Math.PI/180;
let gaiaEpoch=data.gaia_epoch;
let gaiaDate=null;

function gaiaPosition(source){
 const years=gaiaEpoch-2016;
 if(source.pmra===null||source.pmdec===null)return [source.ra,source.dec];
 return [(source.ra+years*source.pmra/(3600000*Math.cos(source.dec*radians))+360)%360,
         source.dec+years*source.pmdec/3600000];
}

function fieldPoint(ra,dec){
 const delta=(ra-data.center[0])*radians, lat=dec*radians, origin=data.center[1]*radians;
 const denominator=Math.sin(lat)*Math.sin(origin)+Math.cos(lat)*Math.cos(origin)*Math.cos(delta);
 const x=Math.cos(lat)*Math.sin(delta)/denominator;
 const y=(Math.sin(lat)*Math.cos(origin)-Math.cos(lat)*Math.sin(origin)*Math.cos(delta))/denominator;
 return pos(x/radians*3600,y/radians*3600);
}

for(const source of data.gaia){
 const group=document.createElementNS(ns,'g');
 group.classList.add('gaia-target');
 group.setAttribute('role','button');
 group.setAttribute('tabindex','0');
 group.setAttribute('aria-label',source.id);
 const label=document.createElementNS(ns,'title');
 label.textContent=source.id;
 const mark=document.createElementNS(ns,'circle');
 mark.setAttribute('r','1.25');
 mark.setAttribute('class','gaia');
 const hit=document.createElementNS(ns,'circle');
 hit.setAttribute('r','2.25');
 hit.setAttribute('class','gaia-hit');
 group.append(label,mark,hit);
 group.onclick=()=>select(source.id);
 group.onkeydown=event=>{
  if(event.key==='Enter'||event.key===' '){event.preventDefault();select(source.id)}
 };
 gaiaMarks.append(group);
 gaiaNodes.set(source.id,group);
}

function updateGaiaEpoch(utc){
 gaiaDate=utc;
 gaiaEpoch=utc?2016+(Date.parse(utc.length===10?utc:utc.replace(' ','T').replace(/Z?$/,'Z'))-Date.UTC(2016,0,1,12))/31557600000:data.gaia_epoch;
 for(const source of data.gaia){
  const [x,y]=fieldPoint(...gaiaPosition(source));
  const marker=gaiaNodes.get(source.id);
  marker.setAttribute('transform',`translate(${x} ${y})`);
  marker.classList.toggle('hidden',x<0||x>121||y<0||y>121);
 }
 const current=gaiaById.get(selected);
 if(current)renderGaiaOverview(current);
 document.dispatchEvent(new Event('atlas-gaia'));
}

function updateGaiaSelection(){
 for(const [id,node] of gaiaNodes)node.setAttribute('aria-pressed',id===selected);
}

const gaiaDetails=new Map();

function loadGaiaDetails(id){
 const state={status:'loading'};
 gaiaDetails.set(id,state);
 const query=new URLSearchParams({source_id:id.slice(5)});
 fetch('api/gaia-source?'+query).then(response=>{
  if(!response.ok)throw Error(response.status);
  return response.json();
 }).then(result=>{
  state.status='ready';
  state.result=result;
 }).catch(()=>{
  state.status='error';
 }).finally(()=>{
  if(selected===id)renderGaiaOverview(gaiaById.get(id));
 });
 return state;
}

function gaiaSpectralSummary(id){
 const spectrum=data.radiance[id];
 const samples=spectrum?.flatMap((value,i)=>Number.isFinite(value)?
  [{value,channel:i+1,wave:data.wavelengths[i]}]:[])??[];
 if(!samples.length)return '';
 const bands=[
  ['Faixas curtas',.75,1.5],
  ['Faixas médias',1.5,3],
  ['Faixas longas',3,5.001]
 ].map(([name,min,max])=>{
  const inside=wave=>wave>=min&&wave<max;
  const total=Object.values(data.bands).filter(inside).length;
  const count=samples.filter(sample=>inside(sample.wave)).length;
  return `<div class="band"><span>${name}</span><meter min="0" max="${total}" value="${count}" aria-label="${name}, ${count} de ${total} canais com medição"></meter><strong>${count}/${total}</strong></div>`;
 }).join('');
 const brightest=samples.reduce((peak,sample)=>sample.value>peak.value?sample:peak);
 return `<details class="evidence" data-section="infrared"><summary>Onde o brilho foi medido</summary>
  <div class="bands">${bands}</div><p>${samples.length} canais com medição no mosaico SPHEREx.
  ${brightest.value>0?`Maior brilho medido no canal ${brightest.channel} (${fmt(brightest.wave)} µm).`:''}</p>
  <p class="caption">As barras indicam cobertura das medições.</p></details>`;
}

function renderGaiaOverview(source){
 renderObjectIdentity(source,true);
 const host=byId('overview');
 const expanded=new Set([...host.querySelectorAll('details[open]')].map(section=>section.dataset.section));
 const state=gaiaDetails.get(source.id)??loadGaiaDetails(source.id);
 const details=state.result;
 const [ra,dec]=gaiaPosition(source);
 const position=source.pmra==null||source.pmdec==null?'Posição do catálogo na época J2016.0.':
  gaiaDate?'Posição estimada para '+gaiaDate.slice(0,10).split('-').reverse().join('/')+' pelo movimento próprio.':
  'Posição estimada para a época de referência do mosaico, J'+data.gaia_epoch+'.';
 const classes=[['Estrela',details?.classprob_dsc_combmod_star],
  ['Galáxia',details?.classprob_dsc_combmod_galaxy],['Quasar',details?.classprob_dsc_combmod_quasar]];
 const best=classes.reduce((leading,entry)=>(entry[1]??0)>(leading[1]??0)?entry:leading);
 const classification=best[1]>=.8?`${best[0]} · ${fmt(best[1]*100,1)}% no classificador Gaia`:'Fonte catalogada';
 const measurement=(label,value,unit,digits=2,error)=>Number.isFinite(value)?
  `<div><dt>${label}</dt><dd>${fmt(value,digits)}${Number.isFinite(error)?' ± '+fmt(error,digits):''} ${unit}</dd></div>`:'';
 const properMotion=Number.isFinite(source.pmra)&&Number.isFinite(source.pmdec)?Math.hypot(source.pmra,source.pmdec):null;
 const summary=measurement('Brilho aparente (G)',source.mag,'mag')+
  measurement('Temperatura estimada',details?.teff_gspphot,'K',0)+
  measurement('Distância estimada',details?.distance_gspphot,'pc',0)+
  measurement('Movimento no céu',properMotion,'mas/ano');
 const technical=measurement('Paralaxe',details?.parallax,'mas',3,details?.parallax_error)+
  measurement('Velocidade radial',details?.radial_velocity,'km/s',2,details?.radial_velocity_error)+
  measurement('Magnitude azul (BP)',details?.phot_bp_mean_mag,'mag')+
  measurement('Magnitude vermelha (RP)',details?.phot_rp_mean_mag,'mag')+
  measurement('Cor BP − RP',details?.bp_rp,'mag')+
  measurement('Qualidade astrométrica (RUWE)',details?.ruwe,'',2);
 const wise=details?.allwise;
 const wiseId=wise&&/^J[0-9.]+[+-][0-9.]+$/.test(wise.id)?wise.id:null;
 const wisePhotometry=measurement('Faixa W1 · 3,4 µm',wise?.w1,'mag',3)+
  measurement('Faixa W2 · 4,6 µm',wise?.w2,'mag',3);
 const allwise=wiseId?`<p>Fonte AllWISE ${wiseId}${Number.isFinite(wise.separation)?' · separação de '+fmt(wise.separation,2)+'″':''}.</p>
  ${wisePhotometry?`<dl class="source-facts">${wisePhotometry}</dl>`:''}
  ${wise.mates>0?`<p>Esta correspondência também está associada a ${fmt(wise.mates,0)} outra(s) fonte(s) Gaia.</p>`:''}`:
  '<p>O cruzamento do catálogo Gaia DR3 não lista uma correspondência AllWISE para esta fonte.</p>';
 const catalogStatus=state.status==='loading'?'<p class="caption" role="status">Consultando dados do Gaia DR3…</p>':
  state.status==='error'?'<p class="caption" role="status">Consulta ao Gaia DR3 indisponível. <button type="button" class="id gaia-retry">Tentar novamente</button></p>':'';
 const sourceNumber=source.id.slice(5);
 host.innerHTML=`<div class="hero"><h2>${classification}</h2>
  ${summary?`<dl class="source-facts">${summary}</dl>`:''}
  ${details?.variable?'<p>O Gaia registrou variação de brilho nesta fonte.</p>':''}
  ${catalogStatus}</div>
  ${gaiaSpectralSummary(source.id)||'<p class="caption">O Eyelid ainda não tem um espectro SPHEREx processado para esta fonte.</p>'}
  ${details?`<details class="evidence" data-section="allwise"><summary>Correspondência no WISE</summary>${allwise}</details>`:''}
  <details class="evidence" data-section="catalog"><summary>Medições e posição no Gaia</summary>
   <p>Ascensão reta ${fmt(ra,7)}° · Declinação ${fmt(dec,7)}°</p><p>${position}</p>
   ${technical?`<dl class="source-facts">${technical}</dl>`:''}
   <p><a target="_blank" rel="noopener" href="https://simbad.cds.unistra.fr/simbad/sim-id?Ident=Gaia+DR3+${sourceNumber}">Buscar esta fonte no SIMBAD</a></p>
  </details>`;
 for(const section of host.querySelectorAll('details'))section.open=expanded.has(section.dataset.section);
 host.querySelector('.gaia-retry')?.addEventListener('click',()=>{
  loadGaiaDetails(source.id);
  renderGaiaOverview(source);
 });
}

byId('gaia-toggle').onchange=event=>{
 gaiaMarks.classList.toggle('hidden',!event.target.checked);
 document.dispatchEvent(new Event('atlas-gaia'));
 document.dispatchEvent(new Event('atlas-gaia-toggle'));
};
updateGaiaEpoch(null);
