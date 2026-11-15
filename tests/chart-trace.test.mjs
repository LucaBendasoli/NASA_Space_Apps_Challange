import test from 'node:test';
import assert from 'node:assert/strict';
import {measurementSegments,tracePlan} from '../src/chart-trace.js';
const row=(w,r)=>({wavelength:w,radiance:r});
test('linha ordena por comprimento de onda e preserva zero e negativos sem alterar dados',()=>{
  const rows=[row(12,3),row(2,-1),row(1,0)],before=structuredClone(rows);
  assert.deepEqual(measurementSegments(rows),[[rows[2],rows[1],rows[0]]]);assert.deepEqual(rows,before);
});
test('linha não atravessa ausências nem conecta medições isoladas',()=>{
  const rows=[row(1,1),row(2,2),row(3,null),row(4,4),row(5,5),row(6,undefined),row(7,7)];
  assert.deepEqual(measurementSegments(rows),[rows.slice(0,2),rows.slice(3,5)]);
  assert.deepEqual(measurementSegments([row(1,0)]),[]);assert.deepEqual(measurementSegments([]),[]);
  assert.deepEqual(measurementSegments([row(1,1),row(2,Infinity),row(3,3)]),[]);
});
test('segmentos são traçados em sequência dentro de uma duração limitada',()=>{
  const plan=tracePlan([1,3],.4);assert.equal(plan[0].start,0);assert.equal(plan[1].start,plan[0].duration);assert.ok(Math.abs(plan[1].duration/plan[0].duration-3)<1e-10);assert.ok(Math.abs(plan[1].start+plan[1].duration-.4)<1e-10);
  assert.deepEqual(tracePlan([]),[]);assert.ok(tracePlan([0,0]).every(p=>Number.isFinite(p.duration)));
});
