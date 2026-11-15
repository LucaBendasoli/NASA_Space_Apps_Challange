import {objectKey} from './science-data.js';
import {formatObservationDate,observationLabel} from './observation-date.js';

export function analysisView(state) {
  const temporal=state.analysisMode==='time';
  const comparison={status:'idle',objects:[],historyStatus:'idle',...(temporal?state.time:state.comparison)};
  const secondary=comparison.status==='ready'?comparison:null;
  const reference=temporal?(comparison.reference||state.selected):state.selected;
  function seriesFor(object,measurements){
    const name=object.name||object.id,date=formatObservationDate(object.observedAt);
    return {key:objectKey(object),name:temporal?`${name} · ${date}`:name,rows:measurements.rows,
      description:temporal?`${name} · ${object.observedAt||'Data não informada'} · Observação ${object.observationId}`:name,
      tableName:temporal?`${date} · ${object.observationId}`:name};
  }
  const series=state.measurements&&reference?[seriesFor(reference,state.measurements),...(secondary?[seriesFor(secondary.selected,secondary.measurements)]:[])]:[];
  let message='',retry=false;
  if(temporal&&comparison.historyStatus==='loading')message='Consultando datas disponíveis deste astro…';
  else if(temporal&&comparison.historyStatus==='error'){message=comparison.historyError;retry=true;}
  else if(comparison.status==='loading')message=temporal?`Carregando medições de ${formatObservationDate(comparison.selected.observedAt)}…`:`Carregando comparação com ${comparison.selected.name||comparison.selected.id}…`;
  else if(comparison.status==='error'){message=comparison.error;retry=true;}
  else if(comparison.status==='empty')message=temporal?'Esta observação não possui medições válidas para comparação.':'Este astro não possui medições válidas para comparação.';
  else if(!comparison.objects.length&&state.selected)message=temporal?'Nenhuma outra observação datada disponível para este astro.':'Nenhum outro astro do catálogo está visível neste campo.';
  return {temporal,comparison,secondary,reference,series,message,retry,
    label:temporal?'Comparar com outra data':'Comparar com outro astro visível',
    placeholder:temporal?'Selecione outra data para comparação':'Selecione outro astro para comparação',
    optionLabel:o=>temporal?observationLabel(o):`${o.name||o.id} · ID ${o.id} · ${o.observationName||o.observationId} [${o.observationId}]`,
    disabled:state.status!=='ready'||!comparison.objects.length||(temporal?comparison.historyStatus!=='ready':state.regionStatus==='loading')};
}
