export const formatMeasurement = row => `${row.bandId} · Comprimento de onda: ${String(row.wavelength)} ${row.wavelengthUnit} · Radiância: ${row.radiance==null?'Ausente':String(row.radiance)} ${row.radianceUnit}${row.uncertainty!=null?` ± ${String(row.uncertainty)}`:''} · Qualidade: ${typeof row.quality==='string'?row.quality:JSON.stringify(row.quality??'Não informada')}`;
// Delegação no painel estável: funciona para pontos SVG e linhas de tabela.
export function setupMeasurementInteraction(host) {
  const tip=document.createElement('div');tip.id='measurement-tooltip';tip.className='measurement-tooltip';tip.setAttribute('role','tooltip');tip.hidden=true;document.body.append(tip);
  const events=new AbortController(),opts={signal:events.signal};let anchor;
  function hide(){if(anchor)anchor.removeAttribute('aria-describedby');anchor=null;tip.hidden=true;for(const n of host.querySelectorAll('[data-band]'))n.classList.remove('band-active');}
  function show(node){
    hide();anchor=node;const band=node.dataset.band;
    for(const n of host.querySelectorAll('[data-band]'))if(n.dataset.band===band&&n.dataset.series===node.dataset.series)n.classList.add('band-active');
    tip.textContent=node.dataset.measurement;tip.hidden=false;node.setAttribute('aria-describedby',tip.id);
    const rect=node.getBoundingClientRect(),bounds=tip.getBoundingClientRect();
    tip.style.left=`${Math.max(8,Math.min(innerWidth-bounds.width-8,rect.left+rect.width/2-bounds.width/2))}px`;
    tip.style.top=`${Math.max(8,Math.min(innerHeight-bounds.height-8,rect.top>bounds.height+16?rect.top-bounds.height-8:rect.bottom+8))}px`;
  }
  host.addEventListener('pointerover',e=>{const n=e.target.closest('[data-measurement]');if(n&&e.pointerType!=='touch')show(n);},opts);
  host.addEventListener('pointermove',e=>{const n=e.target.closest('[data-measurement]');if(n&&e.pointerType!=='touch'&&(tip.hidden||anchor!==n))show(n);},opts);
  host.addEventListener('pointerout',e=>{if(anchor&&!anchor.contains(e.relatedTarget)&&!anchor.contains(document.activeElement))hide();},opts);
  host.addEventListener('focusin',e=>{const n=e.target.closest('[data-measurement]');if(n)show(n);},opts);
  host.addEventListener('focusout',e=>{if(anchor&&!anchor.contains(e.relatedTarget))hide();},opts);
  host.addEventListener('click',e=>{const n=e.target.closest('[data-measurement]');if(n)show(n);},opts);
  document.addEventListener('pointerdown',e=>{if(anchor&&!anchor.contains(e.target))hide();},opts);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!tip.hidden){hide();e.preventDefault();}},{...opts,capture:true});
  host.addEventListener('scroll',()=>{if(anchor&&(anchor.contains(document.activeElement)||anchor.matches(':hover')))show(anchor);else hide();},{...opts,capture:true});window.addEventListener('resize',hide,opts);
  return {hide,dispose(){events.abort();hide();tip.remove();}};
}
