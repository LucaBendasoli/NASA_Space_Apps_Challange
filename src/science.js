import { SCIENCE_CONFIG } from './science-config.js';
import { createProvider, visibleContext, sourceInField } from './science-data.js';
import { readScienceShare } from './science-share.js';
import { createScienceState } from './science-state.js';
import { createScienceCatalog } from './science-catalog.js';
import { renderPanel, disposePanel } from './science-panel.js';
import { createComparisonState } from './science-comparison.js';
import { objectKey } from './science-data.js';
import { createTimeState } from './science-time-state.js';

export function setupScience(A, aladin, survey, presentation) {
  const root=document.getElementById('science-panel');
  const mode=new URLSearchParams(location.search).get('science') || SCIENCE_CONFIG.provider;
  const shared=readScienceShare(location.hash);
  if(!['demo','http'].includes(mode)) {
    renderPanel(root,{status:'off',objects:[],shareError:shared.error||(shared.reference?'A análise compartilhada exige uma fonte de dados configurada. Nenhum dado foi recuperado.':null)},{select(){},retry(){}},false);
    if(shared.reference||shared.error)presentation.open();
    return {schedule(){},getSelection:()=>null,provider:mode};
  }
  const provider=createProvider({...SCIENCE_CONFIG,provider:mode});
  let catalog, timer, currentSurvey=survey(), lastView, pendingShare=shared.reference, retryReference=shared.reference, shareError=shared.error;
  let comparison,time,analysisMode='objects',primaryKey=null,lastData;
  if(pendingShare&&pendingShare.provider!==mode){shareError='O provedor deste link é diferente do provedor ativo. Configure-o explicitamente para recuperar a análise.';pendingShare=retryReference=null;}
  const state=createScienceState(provider, data=>{
    lastData=data;
    const key=data.selected?objectKey(data.selected):null;
    if(primaryKey!==key){primaryKey=key;analysisMode='objects';time?.reset();comparison?.reset();}
    // Aguarda a projeção e a consulta estabilizarem; um resize pode expor geometria transitória.
    if(data.regionStatus!=='loading')comparison?.setCandidates(data.objects.filter(o=>objectKey(o)!==key&&(!data.selected||o.id!==data.selected.id)&&sourceInField(aladin,o)===true));
    render();
  });
  function render(){
    if(!lastData)return;
    const data=lastData;
    // Restaura foco de controles estáveis após atualizar o painel, sem rolar a página.
    const changed=renderPanel(root,{...data,analysisMode,time:time?.value,comparison:comparison?.value,viewSurvey:survey(),shareError},{select,setMode,compare:o=>{if(analysisMode==='time')time.select(o);else if(!o||sourceInField(aladin,o)===true)comparison.select(o);},retryComparison:()=>analysisMode==='time'?time.retry():comparison.retry(),retry:()=>!data.selected&&retryReference?state.restore(retryReference):state.retry(),pin:()=>state.setPinned(!state.value.pinned)},mode==='demo');
    catalog?.render(data.objects,data.selected);
    if(changed)presentation.reveal();
  }
  comparison=createComparisonState(provider,()=>state.value,()=>render());
  time=createTimeState(provider,()=>state.value,()=>render());
  function setMode(next){
    if(!['objects','time'].includes(next)||!state.value.selected||next===analysisMode)return;
    analysisMode=next;render();if(next==='time')time.load();
  }
  const resetComparison=()=>{analysisMode='objects';time.reset();comparison.reset();};
  root.addEventListener('science-open',resetComparison);
  function select(object) {
    resetComparison();
    pendingShare=retryReference=null;shareError=null;
    presentation.open(aladin.world2pix(object.ra,object.dec));
    const content = root.querySelector('.science-content');
    if(content) content.scrollTop = 0;
    state.select(object);state.setInField(sourceInField(aladin,object));
  }
  catalog=createScienceCatalog(A,aladin,select,items=>{presentation.open();state.choose(items);});
  function schedule() {
    if(pendingShare&&pendingShare.surveyId!==survey()){pendingShare=retryReference=null;shareError='O levantamento foi alterado antes da recuperação da análise compartilhada.';}
    const view=JSON.stringify([aladin.getRaDec(),aladin.getFov(),aladin.getSize(),survey(),document.getElementById('projection').value]);
    if(view === lastView) return;
    lastView=view;
    clearTimeout(timer);
    // Invalida imediatamente respostas antigas, consulta só após estabilizar a vista.
    state.invalidate(currentSurvey === survey()); currentSurvey=survey();
    if(state.value.selected)state.setInField(sourceInField(aladin,state.value.selected));
    timer=setTimeout(async()=>{await state.load(visibleContext(aladin,currentSurvey,SCIENCE_CONFIG.observationId));if(pendingShare)await restoreShared();},350);
  }
  async function restoreShared(){const reference=pendingShare;pendingShare=null;if(!reference)return;presentation.open();await state.restore(reference);if(state.value.selected)state.setInField(sourceInField(aladin,state.value.selected));}
  for(const event of ['resizeChanged','projectionChanged']) aladin.on(event,schedule);
  window.addEventListener('pagehide',event=>{if(!event.persisted){clearTimeout(timer);root.removeEventListener('science-open',resetComparison);time.reset();comparison.reset();state.invalidate();presentation.dispose();disposePanel(root);}});
  schedule();if(shareError)presentation.open();
  return {schedule,getSelection:()=>state.value.selected?{object:state.value.selected,pinned:state.value.pinned}:null,provider:mode};
}
