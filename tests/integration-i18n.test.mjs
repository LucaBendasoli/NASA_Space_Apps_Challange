import test from 'node:test';
import assert from 'node:assert/strict';
import { localizeText } from '../src/i18n/science.js';
import { formatMeasurement } from '../src/measurement-interaction.js';
import { formatObservationDate } from '../src/observation-date.js';
import { chartGeometry, formatChartTick } from '../src/chart-geometry.js';

test('ticks localizados preservam as margens e a densidade introduzidas pela main', () => {
  assert.equal(formatChartTick(2.5,'en'),'2.5');
  assert.equal(formatChartTick(2.5,'es'),'2,5');
  const series=[{rows:[{wavelength:1,radiance:-4e-12,uncertainty:1e-13},{wavelength:12,radiance:9e-12,uncertainty:2e-13}]}];
  for(const locale of ['pt-BR','en','es']){
    const g=chartGeometry(series,334,170,locale);
    assert.ok(g.left-8>=Math.max(...g.yTicks.map(n=>formatChartTick(n,locale).length))*7);
    for(let i=1;i<g.yTicks.length;i++)assert.ok(Math.abs(g.y(g.yTicks[i])-g.y(g.yTicks[i-1]))>=22);
  }
});

test('a apresentação científica traduz estados e erros compostos sem mudar o estado de origem', () => {
  const input = '2 fontes disponíveis. Cobertura parcial. Resultados parciais; restrinja a região.';
  assert.equal(localizeText(input,'en'),'2 sources available. Partial coverage. Partial results; narrow the region.');
  assert.equal(localizeText('Erro na consulta regional: API científica: HTTP 503.','es'),'Error en la consulta regional: API científica: HTTP 503.');
  assert.equal(localizeText('Carregando comparação com Fonte simulada B…','en'),'Loading comparison with Simulated source B…');
  assert.equal(localizeText(input,'pt-BR'),input);
});

test('IDs que coincidem com palavras traduzíveis permanecem literais nas opções científicas', () => {
  const option = 'Fonte simulada B · ID Observação · Observação simulada [Banda]';
  assert.equal(localizeText(option,'en'),'Simulated source B · ID Observação · Simulated observation [Banda]');
  assert.equal(localizeText('NGC 224','es'),'NGC 224');
});

test('tooltip traduz rótulos e mantém valores completos, unidades, IDs e qualidade fornecida', () => {
  const row={bandId:'Observação',wavelength:1.23456789123,wavelengthUnit:'µm',radiance:0,radianceUnit:'W m⁻² sr⁻¹ µm⁻¹',uncertainty:.000000123456,quality:{flag:'Não informada'}};
  const before=structuredClone(row);
  const text=formatMeasurement(row,'en');
  assert.match(text,/^Observação · Wavelength: 1\.23456789123 µm/);
  assert.match(text,/Radiance: 0 W m⁻² sr⁻¹ µm⁻¹/);
  assert.equal(Number(text.match(/± ([\d.e+-]+)/)[1]),row.uncertainty);
  assert.match(text,/"flag":"Não informada"/);
  assert.deepEqual(row,before);
  assert.match(formatMeasurement({...row,radiance:null},'es'),/Radiancia: Ausente/);
});

test('datas são localizadas somente na apresentação, com UTC e a compatibilidade original', () => {
  assert.equal(formatObservationDate('2024-02-29'),'29/02/2024');
  assert.notEqual(formatObservationDate('2024-02-29','en'),formatObservationDate('2024-02-29','pt-BR'));
  assert.match(formatObservationDate('2024-02-29T12:34:56Z','es'),/UTC$/);
});
