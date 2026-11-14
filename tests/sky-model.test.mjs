import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCoordinates, parseSesame, readView, viewHash, findTarget, TARGETS, validCoordinates, formatFov, formatDegrees } from '../src/sky-model.js';
test('coordenadas decimais aceitam sinais, espaços, vírgula e polos', () => {
  assert.deepEqual(parseCoordinates('10.68, +41.27'), {ra: 10.68, dec: 41.27});
  assert.deepEqual(parseCoordinates('0 -90'), {ra: 0, dec: -90});
  assert.deepEqual(parseCoordinates('359.999 +90'), {ra: 359.999, dec: 90});
});
test('links preservam zoom profundo e coordenadas sem perda por arredondamento', () => {
  for (const fov of [1 / 36000, .00005, .005, 1e-8, 360]) {
    const view = {ra: 359.999999987654, dec: -89.123456789012, fov, survey: 'dss', projection: 'SIN'};
    assert.deepEqual(readView('#' + viewHash(view)), view);
  }
  for (const fov of [0, -1, NaN, Infinity, 361]) {
    assert.throws(() => viewHash({ra: 0, dec: 0, fov, survey: 'dss', projection: 'SIN'}));
    assert.equal(readView(`#ra=0&dec=0&fov=${fov}`), null);
  }
});
test('campo alterna entre graus, minutos e segundos de arco sem zerar o mínimo nativo', () => {
  assert.equal(formatFov(3), '3.000°');
  assert.equal(formatFov(.5), '30.00′');
  assert.equal(formatFov(1 / 60), '1.00′');
  assert.equal(formatFov(.01), '36.000″');
  assert.equal(formatFov(1 / 36000), '0.100″');
  assert.equal(formatFov(1e-8), '3.60e-5″');
  assert.equal(formatFov(0), '—');
  assert.equal(formatDegrees(10.12345678), '10.12345678°');
  assert.equal(formatDegrees(41.12345678, true), '+41.12345678°');
});
test('entradas fora da esfera são rejeitadas e nomes não viram números', () => {
  for (const value of ['360, 0', '-1 0', '12 91', '12 -91']) assert.throws(() => parseCoordinates(value));
  for (const value of ['M31', '', '12,', '12 3 extra', 'NaN 5', '10 20 30']) assert.equal(parseCoordinates(value), null);
  assert.equal(validCoordinates(NaN, 1), false);
});
test('atalhos são insensíveis a acentos e espaços; lista local é válida', () => {
  assert.equal(findTarget(' andromeda ').id, 'm31');
  assert.equal(findTarget('M 42').id, 'm42');
  assert.equal(findTarget('objeto desconhecido'), undefined);
  for (const t of TARGETS) assert.ok(validCoordinates(t.ra, t.dec));
});
test('Sesame exige uma posição válida e rejeita resposta vazia ou HTML', () => {
  assert.deepEqual(parseSesame('# resolver\n%J 10.684708 +41.268750\n'), {ra: 10.684708, dec: 41.26875});
  assert.throws(() => parseSesame('<html>Indisponível</html>'));
  assert.throws(() => parseSesame('%J 1 100'));
});
test('link compartilhado restaura coordenadas e opções; parâmetros inválidos têm limites', () => {
  const value = {ra: 10.684708, dec: 41.26875, fov: 3, survey: 'wise', projection: 'AIT'};
  assert.deepEqual(readView('#' + viewHash(value)), value);
  for (const hash of ['', '#ra=&dec=&fov=2', '#ra=1&fov=2', '#ra=360&dec=0&fov=2', '#ra=0&dec=0&fov=-1', '#ra=0&dec=0&fov=Infinity']) assert.equal(readView(hash), null);
  assert.equal(readView('#ra=0&dec=0&fov=2&survey=__proto__&projection=x').survey, 'dss');
});
