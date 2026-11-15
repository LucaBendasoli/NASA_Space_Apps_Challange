const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { once } = require('node:events');
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;

let activePage;
async function instrument(context) {
  // Only diagnostics are mocked: the Aladin library, WebAssembly and renderer are real.
  await context.route('**/AladinLiteLogger/**', route => route.fulfill({ status: 200, body: '', headers: { 'access-control-allow-origin': '*' } }));
  await context.route('**/src/app.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()) + '\nwindow.__integrationTest={get map(){return aladin},get science(){return science},workspace};\n' });
  });
}
async function ready(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__integrationTest?.map || !document.getElementById('failure').hidden, { timeout: 65000 });
  assert.equal(await page.evaluate(() => !!window.__integrationTest?.map), true, 'Aladin must initialize; internet and WebGL2 are required');
}
async function clickSource(page, ra = 10.684708, dec = 41.26875) {
  const point = await page.evaluate(([ra, dec]) => window.__integrationTest.map.world2pix(ra, dec), [ra, dec]);
  const box = await page.locator('#aladin').boundingBox();
  await page.mouse.click(box.x + point[0], box.y + point[1]);
  // On narrow maps several nearby markers can share a hit area. Keep the
  // existing disambiguation flow and select the intended source explicitly.
  await page.waitForFunction(() => window.__integrationTest.science.getSelection()?.object || document.querySelector('.science-choices button'));
  if (!await page.evaluate(() => !!window.__integrationTest.science.getSelection()?.object)) {
    await page.locator('.science-choices button').filter({ hasText: 'demo-a' }).click();
  }
}
async function stableScience(page) {
  await page.locator('#science-panel[data-status=ready]').waitFor({ state: 'visible' });
  await page.locator('.science-chart .chart-point').first().waitFor({ state: 'visible' });
}
async function state(page) {
  return page.evaluate(() => {
    const { map, science } = window.__integrationTest;
    return { position: map.getRaDec(), zoom: map.getFov(), size: map.getSize(),
      selection: science.getSelection(), layer: document.getElementById('survey').value,
      projection: document.getElementById('projection').value, mirror: document.getElementById('mirror').value,
      grid: document.getElementById('grid').checked, catalog: document.getElementById('catalog').checked,
      mode: document.querySelector('input[name=science-analysis-mode]:checked')?.value,
      comparison: document.getElementById('science-comparison-source')?.value,
      paths: [...document.querySelectorAll('.science-chart .chart-connection')].map(n => n.getAttribute('d')),
      hash: location.hash, timeOrigin: performance.timeOrigin };
  });
}
async function language(page, locale) {
  await page.locator('#language-select').selectOption(locale);
  assert.equal(await page.locator('html').getAttribute('lang'), locale);
  const saved=await page.evaluate(() => localStorage.getItem('orbita-language'));
  assert.ok(saved===locale||(locale==='en'&&saved===null), 'valid saved preference or initial English default');
}
async function axe(page, selector) {
  const result = await new AxeBuilder({ page }).include(selector).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  assert.deepEqual(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), [], selector);
}

(async () => {
  await fs.mkdir('.tmp', { recursive: true });
  const { makeServer } = await import('../../scripts/serve.mjs');
  const server = makeServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const channel = process.env.BROWSER_CHANNEL || (process.platform === 'win32' ? 'chrome' : undefined);
  let browser;
  try {
    browser = await chromium.launch({ channel, headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark', acceptDownloads: true, locale: 'pt-BR' });
    await instrument(context);
    const page = activePage = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.stack || error.message));
    await ready(page, base + '/?science=demo');
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    await page.waitForFunction(() => document.querySelector('.science-region-status')?.textContent.includes('3 '));
    await clickSource(page); await stableScience(page);
    assert.equal((await page.evaluate(() => window.__integrationTest.science.getSelection())).object.id, 'demo-a');

    // Both-object comparison retains nulls, zero, negatives and uncertainty bars.
    const candidate = await page.locator('#science-comparison-source option').evaluateAll(options => options.find(o => o.textContent.includes('demo-b')).value);
    await page.locator('#science-comparison-source').selectOption(candidate);
    await page.waitForFunction(() => document.querySelectorAll('.science-chart .chart-series').length === 2);
    assert.equal(await page.locator('.science-table-wrap tbody tr').count(), 10);
    assert.match(await page.locator('.science-table-wrap').textContent(), /-0\.3/);
    assert.match(await page.locator('.science-table-wrap').textContent(), /Missing/);
    await page.locator('#science-pin').click();
    const before = await state(page);
    await page.evaluate(() => { window.__mapInstance = window.__integrationTest.map; window.__canvases = [...document.querySelectorAll('#aladin canvas')]; window.__primary = window.__integrationTest.science.getSelection().object; });
    for (const locale of ['pt-BR', 'es', 'en']) {
      await language(page, locale);
      assert.deepEqual(await state(page), before, 'language must preserve all map and analysis state');
      assert.equal(await page.evaluate(() => window.__integrationTest.map === window.__mapInstance && window.__canvases.every(n => n.isConnected) && window.__primary === window.__integrationTest.science.getSelection().object), true);
      assert.equal(await page.locator('#science-pin').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('.science-table-wrap .measurement-unit').count(), 20, 'retain the latest main table layout');
      assert.equal(await page.locator('#share svg').count(), 1, 'retain the latest main share icon');
      const labels = { 'pt-BR': ['Escolher tipo de comparação', 'Identificador do astro'], en: ['Choose comparison type', 'Object identifier'], es: ['Elegir tipo de comparación', 'Identificador del objeto'] };
      assert.equal(await page.locator('.science-mode-title').textContent(), labels[locale][0]);
      assert.equal(await page.locator('.science-metadata-grid dt').first().textContent(), labels[locale][1]);
      assert.equal(await page.locator('.science-metadata-grid dd').first().textContent(), 'demo-a');
      await axe(page, '.language-control');
    }
    assert.match(await page.locator('.science-table-wrap tbody tr').first().textContent(), /Simulated source A/);

    // Temporal comparison, including different wavelengths for different epochs.
    await page.locator('#science-mode-time').check();
    await page.waitForFunction(() => document.querySelectorAll('#science-comparison-source option').length === 3);
    const epoch = await page.locator('#science-comparison-source option').evaluateAll(options => options.find(o => o.textContent.includes('2023')).value);
    await page.locator('#science-comparison-source').selectOption(epoch);
    await page.waitForFunction(() => document.querySelectorAll('.science-chart .chart-series').length === 2);
    assert.match(await page.locator('.science-table-wrap').textContent(), /1\.3 µm/);
    const temporal = await state(page);
    for (const locale of ['es', 'pt-BR', 'en']) { await language(page, locale); assert.deepEqual(await state(page), temporal); }
    const point = page.locator('.science-chart .chart-point').first();
    await point.focus();
    await page.locator('#measurement-tooltip').waitFor({ state: 'visible' });
    await page.evaluate(async () => { const { setLanguage } = await import('/src/i18n/index.js'); setLanguage('es'); });
    assert.match(await page.locator('#measurement-tooltip').textContent(), /Longitud de onda/);
    await page.keyboard.press('Escape');
    await page.locator('#measurement-tooltip').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#science-panel').evaluate(n => n.hidden), false);
    await language(page, 'en');

    // Each modal complements the existing scientific panel without closing/resetting it.
    for (const locale of ['en', 'pt-BR', 'es']) {
      await language(page, locale); const snapshot = await state(page);
      await page.locator('#missions-open').click();
      await page.locator('#missions-panel details').first().evaluate(n => n.open = true);
      await axe(page, '#missions-panel');
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'missions-open');
      assert.equal(await page.locator('#science-panel').evaluate(n => n.hidden), false);
      assert.deepEqual(await state(page), snapshot);
    }
    await language(page, 'en');
    await page.locator('#spectrum-open').click();
    const oldChart = page.locator('#spectrum-host');
    await oldChart.locator('svg[role=img]').waitFor({ state: 'visible' });
    await oldChart.getByRole('button', { name: 'Select objects', exact: true }).click();
    await oldChart.locator('input[type=checkbox]').first().uncheck();
    await oldChart.getByRole('button', { name: 'Done', exact: true }).click();
    const downloadEvent = page.waitForEvent('download');
    await oldChart.getByRole('button', { name: 'Export CSV', exact: true }).click();
    const download = await downloadEvent;
    assert.equal(download.suggestedFilename(), 'spectra.csv');
    assert.equal((await fs.readFile(await download.path(), 'utf8')).trim().split('\r\n').length, 205);
    await page.evaluate(async () => { const { setLanguage } = await import('/src/i18n/index.js'); setLanguage('es'); });
    await oldChart.getByRole('tab', { name: 'Comparar objetos', exact: true }).waitFor();
    assert.equal(await oldChart.locator('.legend>span').count(), 2);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#science-panel').evaluate(n => n.hidden), false);
    await language(page, 'en');

    // Pinned analysis survives real map navigation; sharing still includes its identity.
    await page.evaluate(() => window.__integrationTest.map.gotoRaDec(35, -10));
    await page.waitForFunction(() => document.querySelector('.science-field-state')?.textContent.includes('outside'));
    assert.equal((await page.evaluate(() => window.__integrationTest.science.getSelection())).object.id, 'demo-a');
    assert.equal(await page.locator('#science-pin').getAttribute('aria-pressed'), 'true');
    await page.locator('#share').click();
    assert.match(new URL(page.url()).hash, /objectId=demo-a/);
    assert.match(new URL(page.url()).hash, /pinned=1/);
    await page.screenshot({ path: '.tmp/integrated-desktop.png' });
    assert.deepEqual(errors, [], 'application/renderer errors');

    // Actual Aladin/WebGL on narrow and landscape layouts, without horizontal overflow.
    for (const size of [{ width: 390, height: 844 }, { width: 320, height: 780 }, { width: 844, height: 390 }]) {
      console.log(`Checking real map at ${size.width}×${size.height}`);
      const mobileContext = await browser.newContext({ viewport: size, hasTouch: true, colorScheme: 'dark', reducedMotion: 'reduce' });
      await instrument(mobileContext);
      const mobile = activePage = await mobileContext.newPage();
      await ready(mobile, base + '/?science=demo');
      await mobile.waitForFunction(() => document.querySelector('.science-region-status')?.textContent.includes('3 '));
      await clickSource(mobile); await stableScience(mobile);
      const selected = (await mobile.evaluate(() => window.__integrationTest.science.getSelection())).object.id;
      for (const locale of ['en', 'pt-BR', 'es']) {
        await language(mobile, locale);
        assert.equal((await mobile.evaluate(() => window.__integrationTest.science.getSelection())).object.id, selected);
        assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'page width');
        await mobile.locator('#missions-open').scrollIntoViewIfNeeded();
        await mobile.locator('#missions-open').click();
        assert.equal(await mobile.locator('.missions-scroll').evaluate(n => n.scrollWidth <= n.clientWidth), true);
        await mobile.locator('#missions-close').click();
        assert.equal(await mobile.locator('#science-panel').evaluate(n => n.hidden), false);
      }
      if (size.width === 390) await mobile.screenshot({ path: '.tmp/integrated-mobile.png' });
      await mobile.locator('#science-close').click();
      await mobile.locator('#controls-toggle').click();
      assert.equal(await mobile.locator('#observatory-controls').evaluate(n => n.inert), false);
      await mobile.keyboard.press('Escape');
      assert.equal(await mobile.locator('#controls-toggle').getAttribute('aria-expanded'), 'false');
      await mobileContext.close();
    }

    // Persistence uses the same preference key in a new visit.
    activePage = page;
    await language(page, 'es');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__integrationTest?.map);
    assert.equal(await page.locator('html').getAttribute('lang'), 'es');
    assert.equal(await page.locator('#language-select').inputValue(), 'es');
    await context.close();

    // Exercise the existing HTTP contract with controlled error/pending/success
    // responses. These fixtures test the UI; they are never part of the app.
    const apiContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await instrument(apiContext);
    let requests = 0, measurements = 0, release;
    await apiContext.route('**/api/**', async route => {
      requests++;
      const url = new URL(route.request().url());
      const object = { id: 'http-a', name: 'HTTP source', frame: 'ICRS', ra: 10.684708, dec: 41.26875,
        surveyId: url.searchParams.get('surveyId'), observationId: 'http-observation',
        observedAt: '2025-01-15T03:00:00Z', datasetId: 'http-dataset', imageId: 'http-image' };
      if (url.pathname.endsWith('/measurements')) {
        measurements++;
        if (measurements === 1) return route.fulfill({ status: 503, body: '{}' });
        await new Promise(resolve => { release = resolve; });
        return route.fulfill({ json: { ...object, quantity: 'radiance', complete: true, measurements: [
          { bandId: 'HTTP-1', wavelength: 1, wavelengthUnit: 'µm', radiance: 2, radianceUnit: 'W', uncertainty: 0.1 },
          { bandId: 'HTTP-2', wavelength: 2, wavelengthUnit: 'µm', radiance: 3, radianceUnit: 'W', uncertainty: 0.2 },
        ] } });
      }
      return route.fulfill({ json: { objects: [object], coverage: 'full', complete: true } });
    });
    const apiPage = activePage = await apiContext.newPage();
    await ready(apiPage, base + '/');
    await apiPage.locator('#analysis-toggle').click();
    assert.equal(await apiPage.locator('#science-panel').getAttribute('data-status'), 'off');
    assert.equal(requests, 0, 'default mode never requests or invents scientific data');
    await ready(apiPage, base + '/?science=http');
    await apiPage.waitForFunction(() => document.querySelector('.science-region-status')?.textContent.includes('1 '));
    await clickSource(apiPage);
    await apiPage.locator('#science-panel[data-status=error]').waitFor();
    const afterError = requests;
    for (const locale of ['pt-BR', 'es', 'en']) {
      await language(apiPage, locale);
      assert.match(await apiPage.locator('.science-placeholder').textContent(), /503/);
      assert.equal(requests, afterError, 'translating an error never retries the API');
    }
    await apiPage.locator('#science-retry').click();
    await apiPage.locator('#science-panel[data-status=loading]').waitFor();
    await apiPage.waitForFunction(() => document.querySelector('.science-placeholder')?.textContent.includes('Loading'));
    const loadingRequests = requests;
    await language(apiPage, 'es');
    assert.match(await apiPage.locator('.science-placeholder').textContent(), /Cargando/);
    assert.equal(requests, loadingRequests, 'translating pending data never restarts its request');
    assert.equal(measurements, 2);
    release();
    await stableScience(apiPage);
    assert.equal((await apiPage.evaluate(() => window.__integrationTest.science.getSelection())).object.id, 'http-a');
    assert.equal(await apiPage.locator('.science-table-wrap tbody tr').count(), 2);
    assert.equal(await apiPage.locator('.science-provenance').textContent(), 'Datos científicos del servicio');
    await apiContext.close();
    console.log('PASS: real Aladin/WebGL, map/canvas identity, native selection, two-object and temporal comparison, different wavelength grids, zero/negative/missing values, tooltips, pin/navigation/share, missions, three languages, persistence, original reusable chart/CSV, accessibility, 320/390/844px layouts, default-off mode and controlled HTTP error/retry/pending/success.');
  } catch (error) {
    if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: '.tmp/integration-failure.png' }).catch(() => {});
    throw error;
  } finally {
    await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
