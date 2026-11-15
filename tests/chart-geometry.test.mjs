import test from 'node:test';
import assert from 'node:assert/strict';
import {chartGeometry,formatChartTick} from '../src/chart-geometry.js';
const row=(wavelength,radiance,uncertainty=.2)=>({wavelength,radiance,uncertainty});
test('ampliação ocupa a largura adicional sem mudar os domínios nem os valores',()=>{
  const series=[{rows:[row(1,0),row(2,-1),row(12,3)]}],original=structuredClone(series);
  const compact=chartGeometry(series,480,280),expanded=chartGeometry(series,720,280);
  assert.deepEqual([compact.loX,compact.hiX,compact.loY,compact.hiY],[expanded.loX,expanded.hiX,expanded.loY,expanded.hiY]);
  assert.ok(expanded.x(12)-expanded.x(1)>compact.x(12)-compact.x(1)+180);assert.equal(compact.y(3),expanded.y(3));assert.deepEqual(series,original);
});
test('escala compartilhada inclui as duas séries, incertezas, zero e negativos sem transformar ausências',()=>{
  const a={rows:[row(1,0),row(2,3)]},b={rows:[row(1.3,-2),row(4,8,2),row(12,null,0)]};const g=chartGeometry([a,b]);
  assert.ok(g.loY<-2&&g.hiY>10);assert.ok(g.x(1.3)>g.x(1));assert.ok(g.x(2)<g.x(4));assert.ok(g.y(0)>g.y(8));assert.ok(g.y(10)>=g.top&&g.y(-2)<=g.bottom);assert.equal(b.rows[2].radiance,null);
});
test('uma banda e conjunto vazio produzem escalas finitas sem zero artificial',()=>{
  for(const series of [[],[{rows:[row(2,0)]}],[{rows:[row(2,-3)]}]]){
    const g=chartGeometry(series,320,190);assert.ok(g.hiX>g.loX&&g.hiY>g.loY);assert.ok(Number.isFinite(g.x(2))&&Number.isFinite(g.y(0)));
  }
});
test('projeção responsiva mantém pontos, ticks e rótulos dentro da área útil',()=>{
  const series=[{rows:[row(1,-2),row(12,8)]}];
  for(const [width,height] of [[320,170],[320,190],[440,280],[720,280],[700,156],[375,124]]){
    const g=chartGeometry(series,width,height);assert.ok(g.top<g.bottom&&g.bottom+20<height);assert.ok(g.x(1)>0&&g.x(12)<width);assert.ok(g.y(8)>0&&g.y(-2)<height);assert.ok(g.xTicks.every(t=>g.x(t)>=g.left&&g.x(t)<=g.right));
  }
});
test('gráfico móvel reduz a densidade da grade para não sobrepor os números',()=>{
  for(const values of [[0,4],[-2,8],[-4e-12,9e-12]]){
    const g=chartGeometry([{rows:values.map((value,i)=>row(i+1,value,0))}],334,170);
    for(let i=1;i<g.yTicks.length;i++)assert.ok(Math.abs(g.y(g.yTicks[i])-g.y(g.yTicks[i-1]))>=22);
  }
});
test('rótulos científicos reservam margem sem aproximar números do título do eixo',()=>{
  for(const [width,height] of [[296,170],[480,280],[760,156]]){
    const g=chartGeometry([{rows:[row(.003,-4e-12,1e-13),row(.012,9e-12,2e-13)]}],width,height);
    const longest=Math.max(...g.yTicks.map(n=>formatChartTick(n).length));
    assert.ok(g.left-8>=longest*7);assert.ok(g.bottom+20+16<height-7);
    assert.ok(g.right-g.left>150&&g.bottom>g.top);
    assert.match(formatChartTick(-4e-12),/^-4E-12$/);assert.equal(formatChartTick(2.5),'2,5');assert.equal(formatChartTick(0),'0');
  }
});
