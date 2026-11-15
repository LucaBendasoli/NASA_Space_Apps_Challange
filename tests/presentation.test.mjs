import test from 'node:test';
import assert from 'node:assert/strict';
import { createPresentationState } from '../src/presentation-state.js';
import { createScienceState } from '../src/science-state.js';
const a={id:'a',surveyId:'wise',observationId:'obs'},b={...a,id:'b'};
const data={rows:[{wavelength:1,radiance:1}]};
test('apresentação distingue aberto, fechado e expandido; reabrir a mesma seleção é explícito',()=>{
  const emitted=[],p=createPresentationState(s=>emitted.push(s));p.open();p.open();assert.equal(emitted.length,1);p.expand();assert.equal(p.value.expanded,true);p.close();assert.equal(p.value.open,false);p.open();assert.equal(p.value.open,true);
});
test('fechar durante carregamento não reabre ao receber dados; cache não emite loading',async()=>{
  let resolve,latest;const pending=new Promise(r=>resolve=r),p=createPresentationState(()=>{}),states=[];
  const science=createScienceState({list:async()=>({objects:[a]}),measurements:()=>pending},s=>{latest=s;states.push(s.status);});
  await science.load({radius:1});p.open();const request=science.select(a);p.close();resolve(data);await request;
  assert.equal(latest.status,'ready');assert.equal(p.value.open,false);states.length=0;p.open();await science.select(a);assert.deepEqual(states,['ready']);
});
test('resposta antiga após fechar e reabrir para B nunca mistura identidade e gráfico',async()=>{
  let resolveA,resolveB,latest;const pa=new Promise(r=>resolveA=r),pb=new Promise(r=>resolveB=r),p=createPresentationState(()=>{});
  const science=createScienceState({list:async()=>({objects:[a,b]}),measurements:o=>o.id==='a'?pa:pb},s=>latest=s);
  await science.load({radius:1});p.open();const first=science.select(a);p.close();p.open();const second=science.select(b);assert.equal(latest.measurements,null);resolveB(data);await second;resolveA({rows:[{radiance:99}]});await first;assert.equal(latest.selected.id,'b');assert.equal(latest.measurements,data);assert.equal(p.value.open,true);
});
