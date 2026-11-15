import { SCIENCE_CONFIG } from './science-config.js';
import { createProvider, visibleContext } from './science-data.js';
import { createScienceState } from './science-state.js';
import { createScienceCatalog } from './science-catalog.js';
import { renderPanel } from './science-panel.js';

export function setupScience(A, aladin, survey) {
  const root=document.getElementById('science-panel');
  const mode=new URLSearchParams(location.search).get('science') || SCIENCE_CONFIG.provider;
  if(!['demo','http'].includes(mode)) {
    root.textContent='Medições no infravermelho: selecione uma fonte de dados.';
    const link=document.createElement('a');link.href='?science=demo'+location.hash;link.textContent='Ativar demonstração com dados simulados';root.append(document.createElement('br'),link);return {schedule(){}};
  }
  const provider=createProvider({...SCIENCE_CONFIG,provider:mode});
  let catalog, timer, currentSurvey=survey(), lastView;
  const state=createScienceState(provider, data=>{
    // Restaura foco de controles estáveis após atualizar o painel, sem rolar a página.
    const focused=root.contains(document.activeElement) ? document.activeElement.id : null;
    renderPanel(root,data,{select:o=>state.select(o),clear:()=>state.clear(),retry:()=>state.retry()},mode==='demo');
    catalog?.render(data.objects,data.selected);
    if(focused) document.getElementById(focused)?.focus({preventScroll:true});
  });
  catalog=createScienceCatalog(A,aladin,o=>state.select(o),items=>state.choose(items));
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
  window.addEventListener('pagehide',()=>{clearTimeout(timer);state.invalidate();});
  schedule(); return {schedule};
}
