import test from 'node:test';
import assert from 'node:assert/strict';
import {createComparisonState,comparisonCompatible} from '../src/science-comparison.js';
const a={id:'a',surveyId:'dss',observationId:'obs'},b={...a,id:'b'},c={...a,id:'c'};
const data=(r=0)=>({rows:[{bandId:'B',wavelength:2,wavelengthUnit:'µm',radiance:r,radianceUnit:'R'}]});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function setup(provider){let primary={status:'ready',selected:a,measurements:data()},latest;const state=createComparisonState(provider,()=>primary,s=>latest=s);state.setCandidates([b,c]);return {state,get latest(){return latest;},setPrimary(p){primary=p;}};}
test('comparação inicia sem segundo astro, seleciona apenas candidatos e reseta explicitamente',async()=>{
  const s=setup({measurements:async()=>data(-1)});assert.equal(s.state.value.status,'idle');assert.equal(s.state.value.selected,null);
  await s.state.select(a);assert.equal(s.state.value.selected,null);
  await s.state.select(b);assert.equal(s.latest.status,'ready');assert.equal(s.latest.measurements.rows[0].radiance,-1);
  const generation=s.latest.resetId;s.state.reset();assert.equal(s.latest.selected,null);assert.ok(s.latest.resetId>generation);
  await s.state.select(b);const resetId=s.latest.resetId;await s.state.select(null);assert.equal(s.latest.status,'idle');assert.equal(s.latest.resetId,resetId);
});
test('respostas atrasadas, redefinição e contexto novo não restauram comparação antiga',async()=>{
  const db=deferred(),dc=deferred();const s=setup({measurements:o=>o.id==='b'?db.promise:dc.promise});
  const pb=s.state.select(b),pc=s.state.select(c);dc.resolve(data(3));await pc;db.resolve(data(9));await pb;assert.equal(s.latest.selected.id,'c');
  const late=deferred(),t=setup({measurements:()=>late.promise});const pending=t.state.select(b);t.state.reset();late.resolve(data());await pending;assert.equal(t.latest.selected,null);
  const changed=deferred(),u=setup({measurements:()=>changed.promise});const old=u.state.select(b);u.setPrimary({status:'ready',selected:{...a,observationId:'new'},measurements:data()});u.state.reset();changed.resolve(data());await old;assert.equal(u.latest.selected,null);
});
test('remover candidato fora da vista remove a comparação e invalida requisição',async()=>{
  const pending=deferred(),s=setup({measurements:()=>pending.promise});const loading=s.state.select(b);s.state.setCandidates([c]);pending.resolve(data());await loading;assert.equal(s.latest.selected,null);assert.deepEqual(s.latest.objects,[c]);
  await s.state.select(b);assert.equal(s.latest.selected,null);
});
test('unidades incompatíveis, dados vazios e erro são explícitos; repetir consulta e cache funcionam',async()=>{
  let calls=0,fail=true;const s=setup({measurements:async()=>{calls++;if(fail)throw Error('offline');return data(0);}});
  await s.state.select(b);assert.equal(s.latest.status,'error');fail=false;await s.state.retry();assert.equal(s.latest.status,'ready');s.state.reset();await s.state.select(b);assert.equal(calls,2);
  assert.equal(comparisonCompatible(data(),{rows:[{...data().rows[0],radianceUnit:'Jy'}]}),false);
  const wrong=setup({measurements:async()=>({rows:[{...data().rows[0],wavelengthUnit:'nm'}]})});await wrong.state.select(b);assert.equal(wrong.latest.status,'error');assert.match(wrong.latest.error,/Unidades incompatíveis/);
  let fixed=false;const unitsRetry=setup({measurements:async()=>fixed?data():{rows:[{...data().rows[0],radianceUnit:'other'}]}});await unitsRetry.state.select(b);fixed=true;await unitsRetry.state.retry();assert.equal(unitsRetry.latest.status,'ready');
  const empty=setup({measurements:async()=>({rows:[{...data().rows[0],radiance:null}],incomplete:true})});await empty.state.select(b);assert.equal(empty.latest.status,'empty');
});
test('cache distingue observação e levantamento, sem estado loading artificial',async()=>{
  let calls=0;const states=[],primary={status:'ready',selected:a,measurements:data()};const state=createComparisonState({measurements:async()=>{calls++;return data();}},()=>primary,s=>states.push(s.status));
  state.setCandidates([b,{...b,observationId:'other'}]);await state.select(b);state.reset();states.length=0;await state.select(b);assert.deepEqual(states,['ready']);await state.select({...b,observationId:'other'});assert.equal(calls,2);
});
