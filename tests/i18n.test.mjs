import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dictionaries, getLanguage, isLanguage, t, errorKey, uiError } from '../src/i18n/index.js';

const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

test('os três catálogos têm todas as chaves e os mesmos parâmetros', () => {
  const keys = Object.keys(dictionaries.en).sort();
  for (const [locale, dictionary] of Object.entries(dictionaries)) {
    assert.deepEqual(Object.keys(dictionary).sort(), keys, locale);
    for (const key of keys) {
      assert.ok(typeof dictionary[key] === 'string' && dictionary[key].trim(), `${locale}:${key}`);
      assert.deepEqual(placeholders(dictionary[key]), placeholders(dictionaries.en[key]), `${locale}:${key}`);
    }
  }
});

test('o idioma inicial é inglês e somente as opções próprias são aceitas', () => {
  assert.equal(getLanguage(), 'en');
  for (const locale of ['pt-BR', 'en', 'es']) assert.ok(isLanguage(locale));
  for (const locale of ['fr', 'pt', 'constructor', '__proto__', null, undefined]) assert.equal(isLanguage(locale), false);
  assert.equal(t('notice.found', { query: 'NGC 224' }), 'Object found: NGC 224.');
  assert.throws(() => t('nonexistent.key'), /Missing translation/);
});

test('as mensagens de domínio são traduzidas sem exibir erros crus do provedor', () => {
  assert.equal(errorKey(new Error('Use RA entre 0 e menos de 360° e Dec entre −90 e +90°.')), 'errors.coordinatesRange');
  assert.equal(errorKey(new Error('Failed to fetch')), 'errors.network');
  assert.equal(errorKey({ name: 'AbortError' }), 'errors.searchTimeout');
  assert.equal(errorKey(uiError('errors.webgl')), 'errors.webgl');
  assert.equal(errorKey(new Error('Untrusted upstream message')), 'errors.unknown');
});

test('todas as ligações declarativas do HTML apontam para traduções existentes', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const keys = [...html.matchAll(/data-i18n(?:-(?:aria-label|title|placeholder|content))?="([^"]+)"/g)].map(match => match[1]);
  for (const match of html.matchAll(/data-i18n-nodes="([^"]+)"/g)) {
    keys.push(...Object.values(JSON.parse(match[1].replaceAll('&quot;', '"'))));
  }
  assert.ok(keys.length > 100);
  for (const key of keys) assert.ok(Object.hasOwn(dictionaries.en, key), key);
});

test('todos os rótulos do gráfico estão cobertos nos três idiomas', async () => {
  const source = await readFile(new URL('../src/components/spectrum/components/spectrum-explorer.tsx', import.meta.url), 'utf8');
  for (const [, key] of source.matchAll(/l\('(chart\.[^']+)'/g)) {
    for (const dictionary of Object.values(dictionaries)) assert.ok(Object.hasOwn(dictionary, key), key);
  }
});
