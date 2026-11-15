import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeObservations,normalizeObject,normalizeMeasurements,createProvider,objectKey} from '../src/science-data.js';
import {validateObservationDate,formatObservationDate} from '../src/observation-date.js';
import {createTimeState} from '../src/science-time-state.js';
import {analysisView} from '../src/science-analysis.js';

const a={id:'star-a',name:'Astro A',surveyId:'dss',observationId:'now',observedAt:'2025-01-15T03:00:00Z',frame:'ICRS',ra:10,dec:41};
const b={...a,observationId:'old-b',observedAt:'2023-02-28'},c={...a,observationId:'old-c',observedAt:'2024-02-29T01:30:00Z'};
const data=(w=2,r=0,unit='R')=>({rows:[{bandId:'B',wavelength:w,wavelengthUnit:'µm',radiance:r,radianceUnit:unit,uncertainty:.2,quality:'unknown'}]});
const payload=observations=>({id:a.id,surveyId:a.surveyId,referenceObservationId:a.observationId,complete:true,observations});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function setup(provider){let primary={selected:a,status:'ready',measurements:data()},latest;const state=createTimeState(provider,()=>primary,s=>latest=s);return {state,get latest(){return latest;},setPrimary(p){primary=p;}};}

test('datas preservam precisão e fuso; rejeitam datas inexistentes e horário sem fuso',()=>{
  for(const valid of ['2024-02-29','2025-01-15T03:00:00Z','2025-01-15T00:00:00-03:00'])assert.equal(validateObservationDate(valid),valid);
  for(const invalid of [null,'','2023-02-29','2025-02-31','2025-13-01','2025-01-01T03:00:00','2025-01-01T24:00:00Z','2025-01-01T00:00:00+25:00'])assert.throws(()=>validateObservationDate(invalid));
  assert.equal(formatObservationDate('2024-02-29'),'29/02/2024');assert.match(formatObservationDate(a.observedAt),/UTC/);assert.equal(formatObservationDate(null),'Data não informada');
  assert.throws(()=>normalizeObject({...a,observedAt:'tomorrow'},a));
});
test('histórico ordena por data e valida a identidade, referência, duplicação e limite',()=>{
  const normalized=normalizeObservations({...payload([a,c,b]),complete:false,nextCursor:'next'},a);assert.deepEqual(normalized.observations.map(o=>o.observationId),['old-b','old-c','now']);assert.equal(normalized.partial,true);
  for(const bad of [{...payload([b]),id:'wrong'},{...payload([b]),referenceObservationId:'wrong'},payload([{...b,id:'other'}]),payload([{...b,surveyId:'wise'}]),payload([{...b,frame:'pixels'}]),payload([{...b,observedAt:null}]),payload([b,b]),payload([{...a,observedAt:'2020-01-01'}])])assert.throws(()=>normalizeObservations(bad,a));
  assert.throws(()=>normalizeObservations(payload([a,b]),a,1));assert.deepEqual(normalizeObservations(payload([]),a).observations,[]);
  assert.doesNotThrow(()=>normalizeObservations(payload([{...a,observedAt:'2025-01-15T00:00:00-03:00'}]),a));assert.throws(()=>normalizeObservations(null,a));
  assert.throws(()=>normalizeMeasurements({...a,observedAt:'2020-01-01',quantity:'radiance',complete:true,measurements:data().rows},a),/Data das medições divergente/);
});
test('provedor consulta datas e recupera medições pelo mesmo astro e outra observação',async()=>{
  const urls=[];const provider=createProvider({provider:'http',baseURL:'https://example.invalid/api/',historyLimit:25},async url=>{urls.push(url);return {ok:true,json:async()=>url.pathname.endsWith('/observations')?payload([a,b]):{...b,quantity:'radiance',complete:true,allowNegative:true,measurements:data(3,-1).rows}};});
  const result=await provider.observations(a);assert.equal(result.observations[0].observedAt,b.observedAt);assert.match(urls[0].pathname,/objects\/star-a\/observations$/);assert.equal(urls[0].searchParams.get('referenceObservationId'),'now');assert.equal(urls[0].searchParams.get('limit'),'25');
  const measurements=await provider.measurements(b);assert.equal(urls[1].searchParams.get('observationId'),'old-b');assert.equal(measurements.rows[0].wavelength,3);assert.equal(measurements.rows[0].radiance,-1);
});
test('histórico exclui a referência e mantém uma série até escolher a data',async()=>{
  const s=setup({observations:async()=>normalizeObservations(payload([a,b,c]),a),measurements:async()=>data(3,-1)});await s.state.load();assert.equal(s.latest.historyStatus,'ready');assert.equal(s.latest.status,'idle');assert.equal(s.latest.selected,null);assert.equal(s.latest.reference.observationId,'now');assert.deepEqual(s.latest.objects.map(o=>o.observationId),['old-b','old-c']);
  await s.state.select(a);assert.equal(s.latest.selected,null);await s.state.select(s.latest.objects[0]);assert.equal(s.latest.selected.id,a.id);assert.notEqual(s.latest.selected.observationId,a.observationId);assert.equal(s.latest.measurements.rows[0].wavelength,3);
});
test('escolhas de data fora de ordem não misturam observações do mesmo astro',async()=>{
  const db=deferred(),dc=deferred();const s=setup({observations:async()=>({observations:[a,b,c],partial:false}),measurements:o=>o.observationId===b.observationId?db.promise:dc.promise});await s.state.load();const pb=s.state.select(b),pc=s.state.select(c);dc.resolve(data(4,7));await pc;db.resolve(data(3,99));await pb;assert.equal(s.latest.selected.observationId,c.observationId);assert.equal(s.latest.measurements.rows[0].radiance,7);
});
test('troca de astro ou contexto e reset invalidam histórico e medições atrasados',async()=>{
  const pending=deferred();const s=setup({observations:()=>pending.promise});const task=s.state.load();s.setPrimary({selected:{...a,id:'star-b'},status:'ready',measurements:data()});s.state.reset();pending.resolve({observations:[a,b],partial:false});await task;assert.equal(s.latest.historyStatus,'idle');assert.deepEqual(s.latest.objects,[]);
  const reply=deferred();const t=setup({observations:async()=>({observations:[a,b],partial:false}),measurements:()=>reply.promise});await t.state.load();const selected=t.state.select(b);t.setPrimary({selected:{...a,surveyId:'wise'},status:'ready',measurements:data()});t.state.reset();reply.resolve(data());await selected;assert.equal(t.latest.selected,null);
});
test('histórico falho, parcial, vazio e unidades incompatíveis preservam referência e permitem repetir',async()=>{
  let fails=true;const s=setup({observations:async()=>{if(fails)throw Error('HTTP 404');return {observations:[a,b],partial:true};},measurements:async()=>data(3,2,'other')});await s.state.load();assert.equal(s.latest.historyStatus,'error');assert.match(s.latest.historyError,/404/);fails=false;await s.state.retry();assert.equal(s.latest.partial,true);await s.state.select(b);assert.equal(s.latest.status,'error');assert.match(s.latest.error,/Unidades incompatíveis/);assert.equal(s.latest.reference.id,a.id);
  const empty=setup({observations:async()=>({observations:[],partial:false})});await empty.state.load();assert.equal(empty.latest.historyStatus,'ready');assert.deepEqual(empty.latest.objects,[]);
});
test('histórico e medições usam cache por identidade, com deduplicação de carregamento',async()=>{
  let histories=0,measurements=0;const pending=deferred();const s=setup({observations:()=>{histories++;return pending.promise;},measurements:async()=>{measurements++;return data();}});const first=s.state.load();await s.state.load();pending.resolve({observations:[a,b],partial:false});await first;await s.state.select(b);s.state.reset();await s.state.load();await s.state.select(b);assert.equal(histories,1);assert.equal(measurements,1);
});
test('modo padrão ignora resultado temporal; modo temporal associa eixos e linhas às datas corretas',()=>{
  const primary={selected:a,status:'ready',measurements:data(2,0),objects:[a],time:{historyStatus:'ready',status:'ready',selected:b,measurements:data(3,-1),objects:[b],reference:a}};
  const initial=analysisView(primary);assert.equal(initial.temporal,false);assert.equal(initial.series.length,1);assert.match(initial.label,/outro astro/);
  const temporal=analysisView({...primary,analysisMode:'time'});assert.equal(temporal.series.length,2);assert.deepEqual(temporal.series.map(s=>s.key),[objectKey(a),objectKey(b)]);assert.deepEqual(temporal.series.map(s=>s.rows[0].wavelength),[2,3]);assert.match(temporal.series[1].description,/2023-02-28/);assert.match(temporal.placeholder,/outra data/);assert.equal(temporal.disabled,false);
});
test('demonstração é explícita e fornece valores e comprimentos próprios por época',async()=>{
  const p=createProvider({provider:'demo',limit:500});const list=await p.list({ra:10.68,dec:41.27,radius:2,surveyId:'dss'}),object=list.objects[0],history=await p.observations(object);assert.equal(history.observations.length,3);const now=await p.measurements(object),old=await p.measurements(history.observations[0]);assert.notDeepEqual(now.rows.map(r=>r.wavelength),old.rows.map(r=>r.wavelength));assert.notDeepEqual(now.rows.map(r=>r.radiance),old.rows.map(r=>r.radiance));
});
