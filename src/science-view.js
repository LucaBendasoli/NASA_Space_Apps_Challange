import { chart } from './science-chart.js';
import { objectKey } from './science-data.js';
const views = new WeakMap();
const el = (tag, text, cls) => { const n=document.createElement(tag); if(text!=null)n.textContent=text; if(cls)n.className=cls; return n; };
const number = n => n == null ? 'Ausente' : new Intl.NumberFormat('pt-BR',{maximumSignificantDigits:8}).format(n);
function createView(host) {
  host.replaceChildren();host.setAttribute('aria-labelledby','science-title');
  const heading=el('header',null,'science-heading'), titles=el('div'),title=el('h2','Medições no infravermelho');title.id='science-title';
  const provenance=el('span',null,'science-provenance');titles.append(title,provenance);
  const size=el('button','Ampliar','quiet-button');size.id='science-size';size.setAttribute('aria-controls','science-content');size.setAttribute('aria-expanded','false');
  const close=el('button','×','quiet-button');close.id='science-close';close.setAttribute('aria-label','Fechar medições');heading.append(titles,size,close);
  const content=el('div',null,'science-content');content.id='science-content';
  const context=el('p',null,'science-context'),plot=el('div',null,'science-plot'),notice=el('p',null,'science-note'),status=el('p',null,'science-region-status');
  const live=el('p',null,'sr-only');live.setAttribute('role','status');live.setAttribute('aria-live','polite');
  const retry=el('button','Tentar novamente','quiet-button');retry.id='science-retry';
  const picker=el('div',null,'science-picker'),label=el('label','Selecionar fonte');label.htmlFor='science-source';const select=el('select');select.id='science-source';select.name='science-source';picker.append(label,select);
  const choices=el('div',null,'science-choices'),metadata=el('details',null,'science-metadata');metadata.append(el('summary','Observação e coordenadas'));const meta=el('p',null,'science-note');metadata.append(meta);
  const tableDetails=el('details',null,'science-measurements');tableDetails.id='science-table';const tableSummary=el('summary','Tabela de medições'),tableWrap=el('div',null,'science-table-wrap');tableDetails.append(tableSummary,tableWrap);
  const clear=el('button','Limpar seleção','quiet-button');clear.id='science-clear';
  content.append(context,plot,notice,retry,picker,choices,metadata,tableDetails,status,clear);host.append(heading,content,live);
  const view={title,provenance,content,context,plot,notice,retry,select,choices,metadata,meta,tableDetails,tableSummary,tableWrap,status,clear,live};views.set(host,view);return view;
}
export function renderPanel(host,state,actions,demo) {
  const v=views.get(host)||createView(host),key=state.selected?objectKey(state.selected):null;
  const changed=key!==v.lastKey||state.status!==v.lastStatus||state.measurements!==v.lastRows;
  host.dataset.status=state.status;v.title.textContent=state.selected?.name||'Medições no infravermelho';v.provenance.textContent=demo?'Demonstração · dados simulados':'Dados científicos do backend';
  v.context.textContent=state.selected?`${state.selected.surveyId} · Observação ${state.selected.observationId}`:'Selecione uma fonte do catálogo para analisar suas bandas.';
  const signature=JSON.stringify(state.objects);
  if(v.signature!==signature){v.signature=signature;v.select.replaceChildren(new Option('Escolha um astro…',''));state.objects.forEach((o,i)=>v.select.append(new Option(`${o.name} · ${o.id} · ${o.observationId}`,String(i))));}
  v.select.value=state.selected?String(state.objects.findIndex(o=>objectKey(o)===key)):'';
  v.select.onchange=()=>{if(v.select.value!=='')actions.select(state.objects[Number(v.select.value)]);};v.retry.onclick=()=>actions.retry();v.clear.onclick=()=>actions.clear();
  v.choices.replaceChildren();for(const o of state.candidates||[]){const b=el('button',`${o.name} · ${o.id}`,'quiet-button');b.onclick=()=>actions.select(o);v.choices.append(b);}v.choices.hidden=!state.candidates;
  v.status.textContent=state.regionStatus==='error'?`Consulta regional: ${state.regionError}`:state.regionStatus==='wide'?'Aproxime o mapa: raio máximo da consulta de 10°.':state.coverage==='none'?'Região sem cobertura.':`${state.objects.length} fontes disponíveis.${state.coverage==='partial'?' Cobertura parcial.':''}${state.partial?' Resultados incompletos; restrinja a região.':''}`;
  v.retry.hidden=state.status!=='error'&&state.regionStatus!=='error';
  v.notice.textContent=[state.measurements?.incomplete?'Medições incompletas.':'',state.measurements?.rows.some(r=>r.radiance===null)?'Bandas ausentes não são desenhadas.':''].filter(Boolean).join(' ');v.notice.hidden=!v.notice.textContent;
  v.metadata.hidden=!state.selected;v.tableDetails.hidden=!state.measurements?.rows.length;
  if(state.selected)v.meta.textContent=`${state.selected.id} · ${state.selected.frame} · RA ${number(state.selected.ra)}° · Dec ${number(state.selected.dec)}° · ${state.selected.observationId}`;
  if(changed){
    // Substituição atômica: nunca reutilizar gráfico sob identidade nova.
    v.plot.replaceChildren();v.plot.dataset.objectKey=key||'';
    if(key!==v.lastKey){v.content.scrollTop=0;v.tableDetails.open=false;}
    let message='Selecione um astro no mapa ou na lista.';
    if(state.status==='ready'){const figure=el('figure',null,'science-chart-wrap');figure.append(chart(state.measurements.rows),el('figcaption','Bandas discretas · barras de incerteza fornecidas.'));v.plot.append(figure);message=`Medições de ${state.selected.name} disponíveis.`;}
    else{message=state.status==='loading'?`Carregando medições de ${state.selected.name}…`:state.status==='empty'?'Astro sem medições válidas de radiância.':state.status==='error'?state.error:state.candidates?'Fontes próximas: escolha o astro desejado.':message;v.plot.append(el('p',message,'science-placeholder'));}
    v.live.textContent=message;v.tableWrap.replaceChildren();
    if(state.measurements?.rows.length){const rows=state.measurements.rows,table=el('table');table.append(el('caption','Incerteza na mesma unidade da radiância.'));const head=el('thead'),line=el('tr');for(const s of ['Banda','Comprimento de onda','Radiância','Incerteza','Qualidade']){const th=el('th',s);th.scope='col';line.append(th);}head.append(line);table.append(head);const body=el('tbody');for(const r of rows){const tr=el('tr');for(const text of [r.bandId,`${number(r.wavelength)} ${r.wavelengthUnit}`,`${number(r.radiance)} ${r.radianceUnit}`,number(r.uncertainty),typeof r.quality==='string'?r.quality:JSON.stringify(r.quality??'Não informada')])tr.append(el('td',text));body.append(tr);}table.append(body);v.tableWrap.append(table);v.tableSummary.textContent=`Tabela de medições · ${rows.length} bandas`;}
    v.lastKey=key;v.lastStatus=state.status;v.lastRows=state.measurements;
  }
  return changed;
}
