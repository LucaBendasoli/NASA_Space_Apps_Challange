import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeObject,normalizeMeasurements,objectKey,angularDistance,visibleContext,createProvider} from '../src/science-data.js';
import {createScienceState} from '../src/science-state.js';
import {createScienceCatalog} from '../src/science-catalog.js';
const a={id:'a',observationId:'obs',surveyId:'wise',frame:'ICRS',ra:359.9,dec:0};
const b={...a,id:'b'};
const measurement=(w,r=0)=>({bandId:`b${w}`,wavelength:w,wavelengthUnit:'µm',radiance:r,radianceUnit:'W m⁻² sr⁻¹ µm⁻¹',uncertainty:.2});
const payload=rows=>({...a,quantity:'radiance',allowNegative:true,complete:true,measurements:rows});
const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};};
test('contrato exige identidade, observação, contexto e astrometria válida',()=>{
  assert.equal(objectKey(normalizeObject(a,a)),objectKey(a));
  for(const patch of [{frame:'pixels'},{ra:null},{observationId:''},{surveyId:'dss'}]) assert.throws(()=>normalizeObject({...a,...patch},a));
  assert.notEqual(objectKey(a),objectKey({...a,observationId:'other'}));
});
test('bandas ordenadas numericamente, zero, negativos autorizados e ausentes preservados',()=>{
  const {rows}=normalizeMeasurements(payload([measurement(12,null),measurement(2,-1),measurement(1,0)]),a);
  assert.deepEqual(rows.map(r=>r.wavelength),[1,2,12]);assert.deepEqual(rows.map(r=>r.radiance),[0,-1,null]);
  assert.equal(normalizeMeasurements(payload([measurement(1)]),a).rows.length,1);
  assert.equal(normalizeMeasurements(payload([]),a).rows.length,0);
});
test('rejeita grandeza incorreta, unidades incompatíveis e valores inválidos',()=>{
  for(const p of [ {...payload([]),quantity:'flux'}, {...payload([]),id:'other'},payload([measurement(1,Infinity)]),payload([{...measurement(1),uncertainty:-1}]),payload([{...measurement(1),wavelength:NaN}]),payload([measurement(1),{...measurement(2),radianceUnit:'Jy'}]),{...payload([measurement(1,-2)]),allowNegative:false}]) assert.throws(()=>normalizeMeasurements(p,a));
});
test('região considera altura e RA atravessando zero sem caixa cartesiana',()=>{
  assert.ok(angularDistance(a,{ra:.1,dec:0}) < .21);
  const context=visibleContext({getRaDec:()=>[359.9,0],getFov:()=>[2,4],getFoVCorners:()=>[[.1,1]]},'wise',null);
  assert.equal(context.height,4);assert.equal(context.radius,3);
});
test('selecionar B impede resposta atrasada de A e limpar cancela seleção',async()=>{
  const da=deferred(), db=deferred();let latest;
  const state=createScienceState({list:async()=>({objects:[a,b]}),measurements:o=>o.id==='a'?da.promise:db.promise},s=>latest=s);
  await state.load({radius:1}); const pa=state.select(a),pb=state.select(b);
  db.resolve({rows:[measurement(1,2)]});await pb;da.resolve({rows:[measurement(1,9)]});await pa;
  assert.equal(latest.selected.id,'b');assert.equal(latest.measurements.rows[0].radiance,2);
  state.clear();assert.equal(latest.selected,null);
});
test('troca de contexto invalida região e medições em voo; vazio e erro têm estados próprios',async()=>{
  let latest; const d=deferred();let calls=0;
  const state=createScienceState({list:()=>++calls===1?d.promise:Promise.resolve({objects:[b],coverage:'none'}),measurements:async()=>({rows:[]})},s=>latest=s);
  const old=state.load({radius:1});await state.load({radius:2});d.resolve({objects:[a]});await old;
  assert.deepEqual(latest.objects,[b]);await state.select(b);assert.equal(latest.status,'empty');
  const failed=createScienceState({list:async()=>{throw Error('offline');}},s=>latest=s);await failed.load({radius:1});assert.equal(latest.regionStatus,'error');
  const pending=deferred();const switching=createScienceState({list:async()=>({objects:[a]}),measurements:()=>pending.promise},s=>latest=s);
  await switching.load({radius:1});const selecting=switching.select(a);switching.invalidate();pending.resolve({rows:[measurement(1)]});await selecting;assert.equal(latest.selected,null);assert.equal(latest.measurements,null);
});
test('catálogo mantém identidade científica e desambigua vizinhos',()=>{
  let options,selected,ambiguous;const cat={removeAll(){},addSources(){}};
  const A={catalog:o=>(options=o,cat),source:(ra,dec,data)=>({ra,dec,data,select(){},deselect(){}})};
  const c=createScienceCatalog(A,{addCatalog(){},world2pix:()=>[10,10]},o=>selected=o,items=>ambiguous=items);
  c.render([a],null);options.onClick(A.source(a.ra,a.dec,{object:a}));assert.equal(selected.observationId,'obs');
  c.render([a,b],null);options.onClick(A.source(a.ra,a.dec,{object:a}));assert.deepEqual(ambiguous,[a,b]);
});
test('HTTP falha sem fallback demonstrativo e propaga limites e contexto',async()=>{
  let url;
  const p=createProvider({provider:'http',baseURL:'https://example.invalid/api/',limit:500},async u=>{url=u;return {ok:false,status:503};});
  await assert.rejects(p.list({...a,radius:1},new AbortController().signal),/503/);
  assert.equal(url.searchParams.get('surveyId'),'wise');assert.equal(url.searchParams.get('limit'),'500');
});
test('redimensionar preserva seleção compatível; trocar levantamento a limpa imediatamente',async()=>{
  let latest;const next=deferred();let calls=0;
  const state=createScienceState({list:async()=>++calls===1?{objects:[a]}:next.promise,measurements:async()=>({rows:[measurement(1)]})},s=>latest=s);
  await state.load({radius:1,surveyId:'wise'});await state.select(a);
  const loading=state.load({radius:2,surveyId:'wise'});assert.equal(latest.selected.id,'a');
  next.resolve({objects:[a]});await loading;assert.equal(latest.selected.id,'a');
  state.invalidate(false);assert.equal(latest.selected,null);
});
test('erro de medições permite tentar novamente sem substituir dados',async()=>{
  let latest,fail=true;
  const state=createScienceState({list:async()=>({objects:[a]}),measurements:async()=>{if(fail)throw Error('offline');return {rows:[measurement(1)]};}},s=>latest=s);
  await state.load({radius:1});await state.select(a);assert.equal(latest.status,'error');assert.equal(latest.measurements,null);
  fail=false;await state.select(a);assert.equal(latest.status,'ready');
});
