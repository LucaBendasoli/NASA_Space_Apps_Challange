const el = (tag, text, cls) => { const n = document.createElement(tag); if(text != null) n.textContent = text; if(cls) n.className = cls; return n; };
const number = n => n == null ? 'Ausente' : new Intl.NumberFormat('pt-BR',{maximumSignificantDigits:5}).format(n);
export function renderPanel(root, state, actions, demo) {
  root.replaceChildren();
  const heading = el('div',null,'science-heading');
  heading.append(el('h2','Medições no infravermelho'));
  const close = el('button','Limpar seleção','quiet-button'); close.id='science-clear'; close.onclick=actions.clear; heading.append(close); root.append(heading);
  root.append(el('p',demo ? 'Demonstração explícita · fontes e valores simulados, sem validade científica.' : 'Dados do backend científico · apenas fontes registradas são selecionáveis.','science-note'));
  const messages = {loading:'Consultando astros desta região…',wide:'Aproxime o mapa: a consulta aceita regiões com raio de até 10°.',error:`Não foi possível consultar a região: ${state.regionError}`,ready:state.coverage === 'none' ? 'Região sem cobertura.' : `${state.objects.length} fontes disponíveis.${state.coverage === 'partial' ? ' Cobertura parcial.' : ''}${state.partial ? ' Resultados incompletos: aproxime o mapa para restringir a consulta.' : ''}`};
  const status=el('p',messages[state.regionStatus] || 'Selecione um astro no mapa ou na lista.'); status.setAttribute('role','status'); root.append(status);
  if(state.regionStatus === 'error') { const retry=el('button','Tentar consulta novamente','quiet-button'); retry.onclick=actions.retry; root.append(retry); }
  if(state.objects.length) {
    const label=el('label','Selecionar fonte por teclado'); label.htmlFor='science-source';
    const select=el('select'); select.id='science-source'; select.append(new Option('Escolha um astro…',''));
    state.objects.forEach((o,i)=>select.append(new Option(`${o.name} · ${o.id} · ${o.observationId}`,String(i))));
    select.value=state.selected ? String(state.objects.indexOf(state.selected)) : '';
    select.onchange=()=>{ if(select.value !== '') actions.select(state.objects[Number(select.value)]); };
    root.append(label,select);
  }
  if(state.candidates) {
    root.append(el('p','Fontes próximas: escolha qual astro deseja inspecionar.'));
    const choices=el('div',null,'science-choices');
    for(const o of state.candidates) { const b=el('button',`${o.name} · ${o.id} · ${o.observationId}`,'quiet-button'); b.onclick=()=>actions.select(o); choices.append(b); } root.append(choices);
  }
  const detail=el('div',null,'science-detail'); detail.setAttribute('aria-live','polite'); detail.setAttribute('aria-busy',String(state.status === 'loading')); root.append(detail);
  if(!state.selected) { detail.append(el('p','Selecione um astro para ver suas bandas, unidades e radiâncias.')); return; }
  detail.append(el('h3',state.selected.name),el('p',`${state.selected.id} · Observação ${state.selected.observationId} · ${state.selected.surveyId} · ICRS (${number(state.selected.ra)}°, ${number(state.selected.dec)}°)`,'science-note'));
  if(state.status === 'loading') detail.append(el('p','Carregando medições…'));
  if(state.status === 'error') { detail.append(el('p',state.error)); const retry=el('button','Tentar novamente','quiet-button'); retry.onclick=actions.retry; detail.append(retry); }
  if(state.status === 'empty') detail.append(el('p','Astro sem medições válidas de radiância.'));
  if(!state.measurements) return;
  const {rows,incomplete}=state.measurements;
  if(incomplete) detail.append(el('p','Medições incompletas: há bandas ainda não fornecidas.'));
  if(rows.some(r=>r.radiance === null)) detail.append(el('p','Bandas sem valor são indicadas como ausentes; não são desenhadas no gráfico.'));
  if(state.status === 'ready') { const wrap=el('div',null,'science-chart-wrap'); wrap.append(chart(rows));detail.append(wrap,el('p','Em telas estreitas, deslize o gráfico e a tabela na horizontal para ver todas as bandas.','science-note')); }
  if(!rows.length) return;
  const wrap=el('div',null,'science-table-wrap'), table=el('table');
  table.append(el('caption','Medições por banda (incerteza na mesma unidade da radiância)'));
  const head=el('thead'), tr=el('tr'); for(const text of ['Banda','Comprimento de onda','Radiância','Incerteza','Qualidade']) {const th=el('th',text); th.scope='col';tr.append(th);} head.append(tr); table.append(head);
  const body=el('tbody'); for(const r of rows) { const line=el('tr'); for(const t of [r.bandId,`${number(r.wavelength)} ${r.wavelengthUnit}`,`${number(r.radiance)} ${r.radianceUnit}`,number(r.uncertainty),r.quality == null ? 'Não informada' : JSON.stringify(r.quality)]) line.append(el('td',t));body.append(line); } table.append(body);wrap.append(table);detail.append(wrap);
}
export function chart(rows) {
  const ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg'); svg.setAttribute('viewBox','0 0 800 360');svg.setAttribute('role','img');svg.setAttribute('aria-label','Radiância por comprimento de onda. Valores completos na tabela abaixo.');svg.classList.add('science-chart');
  function node(tag,attrs,text) { const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,v);if(text!=null)n.textContent=text;svg.append(n);return n; }
  const valid=rows.filter(r=>r.radiance !== null), xs=rows.map(r=>r.wavelength), ys=valid.flatMap(r=>[r.radiance-(r.uncertainty || 0),r.radiance+(r.uncertainty || 0)]);
  let loX=Math.min(...xs),hiX=Math.max(...xs),loY=Math.min(0,...ys),hiY=Math.max(0,...ys);
  const padX=(hiX-loX)*.05 || loX*.1, padY=(hiY-loY)*.1 || 1;loX-=padX;hiX+=padX;loY-=padY;hiY+=padY;
  const x=v=>100+(v-loX)/(hiX-loX)*660,y=v=>280-(v-loY)/(hiY-loY)*240;
  for(let i=0;i<=4;i++) {const xv=loX+(hiX-loX)*i/4,yv=loY+(hiY-loY)*i/4;
    node('line',{x1:100,y1:y(yv),x2:760,y2:y(yv),class:'chart-grid'});
    node('text',{x:88,y:y(yv)+4,'text-anchor':'end'},number(yv));node('text',{x:x(xv),y:302,'text-anchor':'middle'},number(xv));
  }
  node('path',{d:'M100 40 V280 H760',class:'chart-axis'});
  node('text',{x:430,y:338,'text-anchor':'middle'},`Comprimento de onda (${rows[0].wavelengthUnit})`);
  node('text',{x:100,y:20},`Radiância (${rows[0].radianceUnit})`);
  for(const r of valid) {
    if(r.uncertainty != null) { const yy=y(r.radiance+r.uncertainty), yb=y(r.radiance-r.uncertainty),xx=x(r.wavelength);node('path',{d:`M${xx} ${yy} V${yb} M${xx-4} ${yy} H${xx+4} M${xx-4} ${yb} H${xx+4}`,class:'chart-error'}); }
    const label=`${r.bandId}: ${number(r.wavelength)} ${r.wavelengthUnit}; ${number(r.radiance)} ${r.radianceUnit}${r.uncertainty != null ? ` ± ${number(r.uncertainty)}`:''}`;
    const point=node('circle',{cx:x(r.wavelength),cy:y(r.radiance),r:5,tabindex:0,'aria-label':label,class:'chart-point'});
    const title=document.createElementNS(ns,'title');title.textContent=label;point.append(title);
  }
  return svg;
}
