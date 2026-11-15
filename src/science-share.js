import { SURVEYS, readView, viewHash } from './sky-model.js';
const fields=['objectId','objectSurvey','observation','pinned','dataProvider'];
const validId=s=>typeof s==='string'&&s.trim().length>0&&s.length<=256&&!/[\u0000-\u001f\u007f]/.test(s);
export function readScienceShare(hash) {
  const p=new URLSearchParams(hash.replace(/^#/,''));
  if(!fields.some(k=>p.has(k)))return {reference:null,error:null};
  if(!readView(hash)||[...fields,'ra','dec','fov','survey','projection'].some(k=>p.getAll(k).length!==1)||!['SIN','AIT','MOL'].includes(p.get('projection'))||!validId(p.get('objectId'))||!validId(p.get('observation'))||!Object.hasOwn(SURVEYS,p.get('objectSurvey'))||p.get('objectSurvey')!==p.get('survey')||!['0','1'].includes(p.get('pinned'))||!['http','demo'].includes(p.get('dataProvider')))return {reference:null,error:'O link de análise contém parâmetros inválidos ou incompatíveis.'};
  return {reference:{id:p.get('objectId'),surveyId:p.get('objectSurvey'),observationId:p.get('observation'),pinned:p.get('pinned')==='1',provider:p.get('dataProvider')},error:null};
}
export function scienceShareHash(view,selected,pinned,provider) {
  const p=new URLSearchParams(viewHash(view));
  if(selected){
    if(!validId(selected.id)||!validId(selected.observationId)||selected.surveyId!==view.survey||!['demo','http'].includes(provider))throw Error('Não foi possível compartilhar uma análise de contexto incompatível.');
    for(const [key,value] of Object.entries({objectId:selected.id,objectSurvey:selected.surveyId,observation:selected.observationId,pinned:pinned?'1':'0',dataProvider:provider}))p.set(key,value);
  }
  return p.toString();
}
export function scienceShareURL(href,view,selected,pinned,provider){
  const url=new URL(href),mode=url.searchParams.get('science');
  url.username='';url.password='';url.search='';
  if(['http','demo'].includes(mode))url.searchParams.set('science',mode);
  url.hash=scienceShareHash(view,selected,pinned,provider);return url;
}
