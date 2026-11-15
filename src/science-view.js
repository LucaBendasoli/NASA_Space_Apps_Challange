import { getLanguage, onLanguageChange, t } from './i18n/index.js';
import { localizeScienceTree, localizeText } from './i18n/science.js';
import { chart, updateChart, disposeChart } from './science-chart.js';
import { objectKey } from './science-data.js';
import { SURVEYS } from './sky-model.js';
import { setupMeasurementInteraction, formatMeasurement } from './measurement-interaction.js';
import { analysisView } from './science-analysis.js';
import { formatObservationDate } from './observation-date.js';
const views = new WeakMap();
const el = (tag, text, cls) => { const n=document.createElement(tag); if(text!=null)n.textContent=text; if(cls)n.className=cls; return n; };
export function regionMessage(state){
  if(state.status==='off')return 'Nenhuma fonte científica está conectada. A análise ainda não foi configurada.';
  if(state.regionStatus==='loading')return 'Consultando fontes nesta região…';
  if(state.regionStatus==='error')return `Erro na consulta regional: ${state.regionError}`;
  if(state.regionStatus==='wide')return 'Aproxime o mapa: raio máximo da consulta de 10°.';
  if(state.regionStatus!=='ready')return 'Escolha uma região para consultar fontes.';
  if(state.coverage==='none')return 'Região sem cobertura científica informada pelo backend.';
  return `${state.objects.length?`${state.objects.length} fontes disponíveis.`:'Consulta concluída: nenhum registro nesta região.'}${state.coverage==='partial'?' Cobertura parcial.':''}${state.partial?' Resultados parciais; restrinja a região.':''}`;
}
function createView(host) {
  host.replaceChildren();host.setAttribute('aria-labelledby','science-title');
  const heading=el('header',null,'science-heading'), titles=el('div'),title=el('h2','Medições no infravermelho');title.id='science-title';
  const provenance=el('span',null,'science-provenance');titles.append(title,provenance);
  const size=el('button','Ampliar','quiet-button');size.id='science-size';size.setAttribute('aria-controls','science-content');size.setAttribute('aria-expanded','false');
  const close=el('button','×','quiet-button');close.id='science-close';close.setAttribute('aria-label','Fechar medições');heading.append(titles,size,close);
  const content=el('div',null,'science-content');content.id='science-content';
  const context=el('div',null,'science-context'),plot=el('div',null,'science-plot'),notice=el('p',null,'science-note'),status=el('p',null,'science-region-status');
  plot.id='science-plot';
  const live=el('p',null,'sr-only');live.setAttribute('role','status');live.setAttribute('aria-live','polite');
  const retry=el('button','Tentar novamente','quiet-button');retry.id='science-retry';
  const choices=el('div',null,'science-choices'),metadata=el('section',null,'science-metadata'),metaTitle=el('h3','Observação e coordenadas','science-section-title');metaTitle.id='science-metadata-title';metadata.setAttribute('aria-labelledby',metaTitle.id);metadata.append(metaTitle);const meta=el('dl',null,'science-metadata-grid');metadata.append(meta);
  const tableSection=el('section',null,'science-measurements');tableSection.id='science-table';const tableTitle=el('h3','Tabela de medições','science-section-title');tableTitle.id='science-table-title';tableSection.setAttribute('aria-labelledby',tableTitle.id);const tableWrap=el('div',null,'science-table-wrap');tableSection.append(tableTitle,tableWrap);
  tableWrap.tabIndex=0;tableWrap.setAttribute('role','region');tableWrap.setAttribute('aria-labelledby',tableTitle.id);
  const tableHint=el('p',null,'science-table-hint');tableHint.id='science-table-hint';tableHint.dataset.i18n='science.tableHint';tableHint.textContent=t('science.tableHint');tableWrap.setAttribute('aria-describedby',tableHint.id);tableSection.insertBefore(tableHint,tableWrap);
  const pin=el('button','Fixar análise','quiet-button');pin.id='science-pin';pin.setAttribute('aria-pressed','false');
  const selectionTools=el('div',null,'science-selection-tools');
  const modes=el('fieldset',null,'science-analysis-modes'),modeTitle=el('legend',t('science.chooseComparison'),'science-mode-title');modeTitle.dataset.i18n='science.chooseComparison';modes.append(modeTitle);
  const modeOptions=el('div',null,'science-mode-options');modes.append(modeOptions);
  const radios=['objects','time'].map((value,i)=>{const label=el('label'),input=el('input');input.type='radio';input.name='science-analysis-mode';input.value=value;input.id=`science-mode-${value}`;input.setAttribute('aria-controls',plot.id);label.append(input,el('span',i?'Ao longo do tempo':'Entre astros'));modeOptions.append(label);return input;});
  const field=el('p',null,'science-field-state'),shareWarning=el('p',null,'science-note');shareWarning.setAttribute('role','status');
  const demoLink=el('a','Experimentar demonstração','demo-link');const url=new URL(location.href);url.searchParams.set('science','demo');url.hash='';demoLink.href=url.href;
  const comparePicker=el('div',null,'science-picker');
  const compareLabel=el('label','Comparar com outro astro visível');compareLabel.htmlFor='science-comparison-source';
  const compareSelect=el('select');compareSelect.id='science-comparison-source';compareSelect.name='science-comparison-source';
  const compareStatus=el('p',null,'science-note');compareStatus.setAttribute('role','status');
  const compareRetry=el('button','Tentar comparação novamente','quiet-button');comparePicker.append(compareLabel,compareSelect);selectionTools.append(comparePicker,pin);
  const legend=el('ul',null,'science-legend');legend.setAttribute('aria-label','Astros no gráfico');
  content.append(context,compareStatus,compareRetry,legend,plot,notice,shareWarning,retry,choices,tableSection,metadata,status);host.append(heading,modes,selectionTools,field,demoLink,content,live);
  const view={title,provenance,content,context,plot,notice,retry,choices,metadata,meta,tableSection,tableTitle,tableWrap,status,live,pin,selectionTools,modes,radios,field,shareWarning,demoLink,compareLabel,compareSelect,compareStatus,compareRetry,legend,interaction:setupMeasurementInteraction(host)};views.set(host,view);view.removeLanguage=onLanguageChange(()=>{if(host.isConnected && view.lastState)renderPanel(host,view.lastState,view.lastActions,view.lastDemo);});return view;
}
export function renderPanel(host,state,actions,demo) {
  const v=views.get(host)||createView(host),key=state.selected?objectKey(state.selected):null;
  v.lastState=state;v.lastActions=actions;v.lastDemo=demo;
  const languageChanged=v.language!==getLanguage();
  const analysis=analysisView(state,getLanguage()),{temporal,comparison,secondary,reference,series}=analysis;
  const secondaryKey=secondary?objectKey(secondary.selected):null;
  const dataChanged=key!==v.lastKey||temporal!==v.lastTemporal||reference?.observedAt!==v.lastReferenceDate||state.status!==v.lastStatus||state.measurements!==v.lastRows||state.error!==v.lastError||secondaryKey!==v.lastComparisonKey||secondary?.measurements!==v.lastComparisonRows;
  const languageOnly=languageChanged&&!dataChanged,changed=dataChanged||languageChanged;
  const off=state.status==='off';
  host.dataset.status=state.status;v.title.textContent=off?'Análise não configurada':state.selected?.name||'Medições no infravermelho';v.provenance.textContent=off?'Sem conexão científica':demo?'Demonstração ativada · valores simulados':'Dados científicos do backend';
  v.title.title=v.title.textContent;
  v.provenance.title=v.provenance.textContent;
  const surveyLabel=SURVEYS[state.viewSurvey||state.selected?.surveyId]?.label||'levantamento atual';
  const contextKey=JSON.stringify([off,surveyLabel,Boolean(state.selected),state.selected?.datasetName,getLanguage()]);
  if(contextKey!==v.contextKey){
    v.contextKey=contextKey;v.context.replaceChildren();
    if(off)v.context.textContent='Conecte um provedor científico ou experimente os dados simulados.';
    else for(const [label,value] of [['science.backgroundLabel',surveyLabel],...(state.selected?[['science.measurementsLabel',state.selected.datasetName||'Conjunto não informado']]:[])]){const item=el('span'),valueNode=el('span',localizeText(value));valueNode.translate=false;item.append(el('span',t(label)+' ','science-context-label'),valueNode);v.context.append(item);}
  }
  v.selectionTools.hidden=off||!state.selected;v.demoLink.hidden=!off;v.pin.disabled=!state.selected;v.pin.textContent=state.pinned?'Desfixar análise':'Fixar análise';v.pin.setAttribute('aria-pressed',String(Boolean(state.pinned)));v.pin.onclick=()=>actions.pin?.();
  v.modes.hidden=off||!state.selected;v.radios.forEach(input=>{input.checked=input.value===(temporal?'time':'objects');input.onchange=()=>{if(input.checked)actions.setMode(input.value);};});
  v.field.textContent=state.selected&&state.inField===false?'Fonte fora do campo atual':state.selected&&state.regionalMissing?(state.partial?'Fonte não retornada nesta resposta parcial.':'Fonte ausente do catálogo regional atual.') :state.pinned?'Análise fixada durante a exploração.':'';v.field.hidden=!v.field.textContent;
  v.shareWarning.textContent=state.shareError||'';v.shareWarning.hidden=!state.shareError;
  v.retry.onclick=()=>actions.retry();
  v.compareLabel.textContent=analysis.label;
  const compareSignature=JSON.stringify([temporal,comparison.objects,getLanguage()]);
  if(compareSignature!==v.compareSignature){v.compareSignature=compareSignature;v.compareSelect.replaceChildren(new Option(analysis.placeholder,''));comparison.objects.forEach((o,i)=>v.compareSelect.append(new Option(analysis.optionLabel(o),String(i))));}
  v.compareSelect.value=comparison.selected?String(comparison.objects.findIndex(o=>objectKey(o)===objectKey(comparison.selected))):'';
  v.compareSelect.disabled=analysis.disabled;
  v.compareSelect.onchange=()=>actions.compare(v.compareSelect.value===''?null:comparison.objects[Number(v.compareSelect.value)]);
  v.compareStatus.textContent=analysis.message;v.compareStatus.hidden=!analysis.message||!state.selected;
  v.compareRetry.hidden=!analysis.retry;v.compareRetry.onclick=()=>actions.retryComparison();
  v.choices.replaceChildren();for(const o of state.candidates||[]){const b=el('button',`${o.name} · ${o.id}`,'quiet-button');b.onclick=()=>actions.select(o);v.choices.append(b);}v.choices.hidden=!state.candidates;
  v.status.textContent=regionMessage(state);
  v.retry.hidden=state.status!=='error'&&state.regionStatus!=='error';
  v.notice.textContent=[temporal?'Mesma fonte em observações diferentes; o fundo HiPS não muda.':'',temporal&&comparison.partial?'Lista de datas parcial; podem existir outras observações.':'',state.coverage==='partial'?'Cobertura científica parcial.':'',state.partial?'Resultados regionais parciais.':'',state.measurements?.incomplete?'Medições principais incompletas.':'',secondary?.measurements.incomplete?'Medições da comparação incompletas.':'',series.some(s=>s.rows.some(r=>r.radiance===null))?'Bandas ausentes não são desenhadas nem conectadas.':''].filter(Boolean).join(' ');v.notice.hidden=!v.notice.textContent;
  v.metadata.hidden=!state.selected;v.tableSection.hidden=!state.measurements?.rows.length;
  if(state.selected){
    const o=state.selected;
    const entries=[['science.objectIdentifier',o.id],['science.coordinates',`${o.frame} · RA ${String(o.ra)}° · Dec ${String(o.dec)}°`],['science.background',`${localizeText(surveyLabel)} · ${o.surveyId}`],['science.dataset',`${localizeText(o.datasetName||'Não informado')} · ${o.datasetId||localizeText('ID não informado')}`],['science.referenceObservation',`${localizeText(o.observationName||'Sem nome')} · ${o.observationId}`],['science.dateAndImage',`${reference?.observedAt||localizeText('Data não informada')} · ${reference?.imageId||t('science.imageMissing')}`],...(temporal&&secondary?[['science.comparedObservation',`${secondary.selected.observedAt} · ${secondary.selected.observationId} · ${secondary.selected.imageId||t('science.imageMissing')}`]]:[])];
    const signature=JSON.stringify([entries,getLanguage()]);
    if(signature!==v.metaSignature){v.metaSignature=signature;v.meta.replaceChildren();for(const [label,value] of entries){const pair=el('div'),definition=el('dd',value);definition.translate=false;pair.append(el('dt',t(label)),definition);v.meta.append(pair);}}
  }
  if(changed){
    // Nova identidade troca o gráfico; uma comparação atualiza somente suas séries.
    const retained=key===v.lastKey&&state.status==='ready'&&v.chartSvg?.isConnected;
    if(!languageOnly)v.interaction.hide();
    if(!retained){if(v.chartSvg)disposeChart(v.chartSvg);v.chartSvg=null;v.plot.replaceChildren();}
    v.plot.dataset.objectKey=key||'';v.plot.dataset.reveal=retained?'series':'all';
    v.legend.replaceChildren();v.legend.hidden=state.status!=='ready';
    v.legend.setAttribute('aria-label',temporal?'Observações no gráfico':'Astros no gráfico');
    if(state.status==='ready')series.forEach((s,i)=>{const item=el('li',null,i?'comparison-series':'primary-series');item.append(el('span',null,'series-swatch'),el('span',temporal?`${formatObservationDate(i?secondary.selected.observedAt:reference?.observedAt,getLanguage())} (${i?'comparação':'referência'})`:`${s.name} (${i?'comparação':'principal'})`));item.title=`${s.description} · ${s.key}`;v.legend.append(item);});
    if(key!==v.lastKey)v.content.scrollTop=0;
    let message=off?'Nenhuma consulta foi realizada. Ative uma fonte de dados para analisar o céu.':'Clique em um astro no mapa para visualizar suas medições.';
    if(state.status==='ready'){
      if(retained)updateChart(v.chartSvg,state.measurements.rows,series);
      else{const figure=el('figure',null,'science-chart-wrap');v.chartSvg=chart(state.measurements.rows,series);figure.append(v.chartSvg,el('figcaption','Bandas discretas · barras de incerteza fornecidas.'));v.plot.append(figure);}
      message=secondary?`Comparação de ${series[0].name} e ${series[1].name} disponível.`:`Medições de ${series[0].name} disponíveis.`;
    }
    else{message=state.status==='restoring'?'Recuperando a fonte compartilhada…':state.status==='loading'?`Carregando medições de ${state.selected.name}…`:state.status==='empty'?'Astro sem medições válidas de radiância.':state.status==='error'?state.error:state.candidates?'Fontes próximas: escolha o astro desejado.':message;v.plot.append(el('p',message,'science-placeholder'));}
    v.live.textContent=message;if(!languageOnly)v.tableWrap.replaceChildren();
    if(state.measurements?.rows.length){
      const table=el('table');table.append(el('caption',t('science.tableCaption'),'sr-only'));
      const head=el('thead'),line=el('tr');for(const s of [temporal?'Observação':'Astro','Banda','Comprimento de onda','Radiância','Incerteza','Qualidade']){const th=el('th',s);th.scope='col';line.append(th);}head.append(line);table.append(head);
      const body=el('tbody');for(const s of series)for(const r of s.rows){
        const tr=el('tr');tr.dataset.band=r.bandId;tr.dataset.series=s.key;tr.dataset.measurement=`${s.description} · ${formatMeasurement(r,getLanguage())}`;tr.tabIndex=0;tr.setAttribute('aria-label',tr.dataset.measurement);
        tr.append(el('td',localizeText(s.tableName)),el('td',r.bandId));
        for(const [value,unit] of [[String(r.wavelength),r.wavelengthUnit],[r.radiance==null?localizeText('Ausente'):String(r.radiance),r.radianceUnit]]){const cell=el('td');cell.append(el('span',value,'measurement-value'),document.createTextNode(' '),el('span',unit,'measurement-unit'));tr.append(cell);}
        tr.append(el('td',r.uncertainty==null?localizeText('Não informada'):String(r.uncertainty)),el('td',typeof r.quality==='string'?r.quality:JSON.stringify(r.quality??localizeText('Não informada'))));for(const cell of tr.children)cell.translate=false;body.append(tr);
      }table.append(body);
      const existing=languageOnly&&v.tableWrap.querySelector('table');
      if(existing){
        for(const selector of ['caption','th','td']){const old=[...existing.querySelectorAll(selector)],fresh=[...table.querySelectorAll(selector)];fresh.forEach((n,i)=>{if(!old[i])return;if(n.childElementCount){[...n.children].forEach((child,j)=>{old[i].children[j].textContent=child.textContent;});}else old[i].textContent=n.textContent;});}
        const oldRows=[...existing.querySelectorAll('tbody tr')];[...table.querySelectorAll('tbody tr')].forEach((row,i)=>{if(oldRows[i]){oldRows[i].dataset.measurement=row.dataset.measurement;oldRows[i].setAttribute('aria-label',row.getAttribute('aria-label'));}});
      }else v.tableWrap.append(table);v.tableTitle.textContent=`Tabela de medições · ${series.reduce((n,s)=>n+s.rows.length,0)} bandas`;
    }
    v.lastKey=key;v.lastStatus=state.status;v.lastRows=state.measurements;v.lastError=state.error;
    v.lastComparisonKey=secondaryKey;v.lastComparisonRows=secondary?.measurements;
    v.lastTemporal=temporal;v.lastReferenceDate=reference?.observedAt;
  }
  const caption=v.plot.querySelector('figcaption');
  if(caption)caption.textContent=[state.measurements?.incomplete?'Medições incompletas':null,state.measurements?.rows.some(r=>r.radiance===null)?'bandas ausentes':null,state.partial||state.coverage==='partial'?'região parcial':null,v.plot.querySelector('.chart-connection')?'Linha: apoio visual entre bandas, não espectro contínuo. Barras: incerteza.':'Medições isoladas. Barras: incerteza.'].filter(Boolean).join(' · ');
  v.language=getLanguage();
  localizeScienceTree(host);
  if(languageOnly)v.interaction.refresh();
  return changed;
}
export function disposePanel(root){const view=views.get(root);view?.removeLanguage?.();view?.interaction.dispose();if(view?.chartSvg)disposeChart(view.chartSvg);views.delete(root);}
