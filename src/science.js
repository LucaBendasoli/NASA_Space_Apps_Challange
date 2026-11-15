import { SCIENCE_CONFIG } from './science-config.js';
import { createProvider, visibleContext } from './science-data.js';
import { createScienceState } from './science-state.js';
import { createScienceCatalog } from './science-catalog.js';
import { renderPanel } from './science-panel.js';

export function setupScience(A, aladin, survey, presentation) {
  const root=document.getElementById('science-panel');
  const mode=new URLSearchParams(location.search).get('science') || SCIENCE_CONFIG.provider;
  if(!['demo','http'].includes(mode)) {
    renderPanel(root,{status:'initial',objects:[]},{select(){},clear(){},retry(){}},false);
    const link=document.createElement('a');link.href='?science=demo'+location.hash;link.className='text-link';link.textContent='Ativar demonstração com dados simulados';root.querySelector('.science-plot').append(link);return {schedule(){}};
  }
  const provider=createProvider({...SCIENCE_CONFIG,provider:mode});
  let catalog, timer, currentSurvey=survey(), lastView;
  const state=createScienceState(provider, data=>{
    // Restaura foco de controles estáveis após atualizar o painel, sem rolar a página.
    const changed=renderPanel(root,data,{select,clear:()=>state.clear(),retry:()=>state.retry()},mode==='demo');
    catalog?.render(data.objects,data.selected);
    if(changed)presentation.reveal();
  });
  function select(object) {
    presentation.open(aladin.world2pix(object.ra,object.dec));
    const content = root.querySelector('.science-content');
    if(content) content.scrollTop = 0;
    state.select(object);
  }
  catalog=createScienceCatalog(A,aladin,select,items=>{presentation.open();state.choose(items);});
  function schedule() {
    const view=JSON.stringify([aladin.getRaDec(),aladin.getFov(),aladin.getSize(),survey(),document.getElementById('projection').value]);
    if(view === lastView) return;
    lastView=view;
    clearTimeout(timer);
    // Invalida imediatamente respostas antigas, consulta só após estabilizar a vista.
    state.invalidate(currentSurvey === survey()); currentSurvey=survey();
    timer=setTimeout(()=>state.load(visibleContext(aladin,currentSurvey,SCIENCE_CONFIG.observationId)),350);
  }
  for(const event of ['resizeChanged','projectionChanged']) aladin.on(event,schedule);
  window.addEventListener('pagehide',event=>{if(!event.persisted){clearTimeout(timer);state.invalidate();presentation.dispose();}});
  schedule(); return {schedule};
}
