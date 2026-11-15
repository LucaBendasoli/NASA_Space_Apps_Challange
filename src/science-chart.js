import {formatMeasurement} from './measurement-interaction.js';
import {measurementSegments} from './chart-trace.js';
import {chartGeometry} from './chart-geometry.js';
export {linearTicks} from './chart-geometry.js';

const ns='http://www.w3.org/2000/svg',charts=new WeakMap();
const svgNode=tag=>document.createElementNS(ns,tag);
function attributes(node,attrs){for(const [key,value] of Object.entries(attrs))if(node.getAttribute(key)!==String(value))node.setAttribute(key,value);}
function patch(parent,nodes,used,key,tag,attrs,text){
  let node=nodes.get(key);
  if(!node){node=svgNode(tag);nodes.set(key,node);if(attrs.class)node.setAttribute('class',attrs.class);parent.append(node);}
  // Mantém classes de foco/hover e estilos da animação em andamento.
  const {class:className,...rest}=attrs;attributes(node,rest);
  if(text!=null&&node.textContent!==text)node.textContent=text;
  used.add(key);return node;
}
function prune(nodes,used){for(const [key,node] of nodes)if(!used.has(key)){node.remove();nodes.delete(key);}}

function layout(record){
  const {svg,series,width,height,axes,axisNodes,groups,rows}=record;
  const g=chartGeometry(series,width,height),{x,y,left,right,top,bottom}=g;
  attributes(svg,{viewBox:`0 0 ${width} ${height}`});
  const usedAxes=new Set(),axis=(key,tag,attrs,text)=>patch(axes,axisNodes,usedAxes,key,tag,attrs,text);
  const tick=n=>new Intl.NumberFormat('pt-BR',{maximumSignificantDigits:4,notation:Math.abs(n)>=10000||(n!==0&&Math.abs(n)<.01)?'scientific':'standard'}).format(n);
  for(const value of g.yTicks){
    axis(`grid:${value}`,'line',{x1:left,y1:y(value),x2:right,y2:y(value),class:'chart-grid'});
    axis(`y:${value}`,'text',{x:left-8,y:y(value)+4,'text-anchor':'end'},tick(value));
  }
  for(const value of g.xTicks)axis(`x:${value}`,'text',{x:x(value),y:bottom+20,'text-anchor':'middle'},tick(value));
  if(g.loY<=0&&g.hiY>=0)axis('zero','line',{x1:left,x2:right,y1:y(0),y2:y(0),class:'chart-zero','aria-label':'Referência de radiância zero'});
  axis('frame','path',{d:`M${left} ${top} V${bottom} H${right}`,class:'chart-axis'});
  axis('x-title','text',{x:(left+right)/2,y:height-6,'text-anchor':'middle'},`Comprimento de onda (${rows[0]?.wavelengthUnit||''})`);
  axis('y-title','text',{x:12,y:19},`Radiância (${rows[0]?.radianceUnit||''})`);
  prune(axisNodes,usedAxes);
  const usedGroups=new Set();
  for(const [index,s] of series.entries()){
    let group=groups.get(s.key);
    if(!group){
      const node=svgNode('g');node.setAttribute('class','chart-series');node.dataset.entering='true';svg.append(node);
      group={node,nodes:new Map()};groups.set(s.key,group);
    }
    const {node,nodes}=group,used=new Set();usedGroups.add(s.key);
    node.classList.toggle('primary-series',index===0);node.classList.toggle('comparison-series',index!==0);
    attributes(node,{'data-series':s.key,'aria-label':s.name});
    const mark=(key,tag,attrs)=>patch(node,nodes,used,key,tag,attrs);
    for(const segment of measurementSegments(s.rows)){
      const points=segment.map(r=>[x(r.wavelength),y(r.radiance)]);
      const length=points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0);
      mark(`line:${JSON.stringify(segment.map(r=>r.bandId))}`,'path',{d:points.map((p,i)=>`${i?'L':'M'}${p[0]} ${p[1]}`).join(' '),pathLength:1,class:'chart-connection','data-trace-length':length,'aria-hidden':'true'});
    }
    for(const r of s.rows.filter(r=>r.radiance!==null)){
      if(r.uncertainty!=null){
        const yy=y(r.radiance+r.uncertainty),yb=y(r.radiance-r.uncertainty),xx=x(r.wavelength);
        mark(`error:${r.bandId}`,'path',{d:`M${xx} ${yy} V${yb} M${xx-4} ${yy} H${xx+4} M${xx-4} ${yb} H${xx+4}`,class:'chart-error','data-band':r.bandId,'data-series':s.key});
      }
      const description=`${s.description||s.name} · ${formatMeasurement(r)}`;
      mark(`point:${r.bandId}`,'circle',{cx:x(r.wavelength),cy:y(r.radiance),r:2.5,tabindex:0,'aria-label':description,'data-series':s.key,'data-band':r.bandId,'data-measurement':description,class:'chart-point'});
    }
    prune(nodes,used);
  }
  for(const [key,group] of groups)if(!usedGroups.has(key)){group.node.remove();groups.delete(key);}
}

export function chart(rows,series=[{key:'primary',name:'Astro principal',rows}]){
  const svg=svgNode('svg'),axes=svgNode('g');svg.classList.add('science-chart');axes.classList.add('chart-axes');svg.append(axes);
  attributes(svg,{role:'group','aria-label':'Radiância por comprimento de onda. Pontos acessíveis por teclado; valores na tabela de medições.'});
  const record={svg,axes,axisNodes:new Map(),groups:new Map(),rows,series,width:440,height:280};charts.set(svg,record);layout(record);
  // O observador já traz as dimensões. Não lê layout nem redimensiona o Aladin.
  if(typeof ResizeObserver!=='undefined'){
    record.observer=new ResizeObserver(entries=>{
      const {width,height}=entries[0].contentRect;
      if(width>0&&height>0&&(Math.abs(width-record.width)>.1||Math.abs(height-record.height)>.1)){record.width=width;record.height=height;layout(record);}
    });record.observer.observe(svg);
  }
  return svg;
}
export function updateChart(svg,rows,series){const record=charts.get(svg);if(record){record.rows=rows;record.series=series;layout(record);}}
export function disposeChart(svg){charts.get(svg)?.observer?.disconnect();charts.delete(svg);}
