import { TARGETS, SURVEYS, findTarget, parseCoordinates, parseSesame, readView, viewHash, formatDegrees, formatFov } from './sky-model.js';
import { createFrameUpdater, setTextIfChanged } from './frame-updater.js';
import { t, onLanguageChange, errorKey, uiError } from './i18n/index.js';

const $ = id => document.getElementById(id);
let aladin, catalog, noticeTimer, searchController, surveyController, navigation = 0;
const readout = { ra: $('ra'), dec: $('dec'), fov: $('fov'), name: $('view-name') };
const readoutUpdates = createFrameUpdater(syncReadout);
let exploring = false;
const shared = readView(location.hash);
const start = shared || { ...TARGETS[0], survey: 'dss', projection: 'SIN' };
let viewName = { key: shared ? 'view.shared' : 'targets.m31' };
let statusKey = 'status.connecting';
let currentNotice, currentFailure;
let catalogSources = [];
$('survey').value = start.survey;
$('projection').value = start.projection;
function renderDynamicText() {
  setTextIfChanged(readout.name, viewName.literal ?? t(viewName.key));
  setTextIfChanged($('engine-status'), t(statusKey));
  updateSurveyText();
  if (currentFailure) $('failure-message').textContent = t(errorKey(currentFailure));
  if (catalog) catalog.name = t('catalog.name');
  if (currentNotice && !$('notice').hidden) {
    const { key, parameters } = currentNotice;
    $('notice').textContent = t(key, parameters.targetId ? { ...parameters, name: t(`targets.${parameters.targetId}`) } : parameters);
  }
  catalogSources.forEach((source, index) => {
    source.data.name = t(`targets.${TARGETS[index].id}`);
    source.data.origem = t('catalog.origin');
  });
  if ($('target').validity.customError) $('target').setCustomValidity(t('search.required'));
}
function setStatus(key) { statusKey = key; $('engine-status').textContent = t(key); }
onLanguageChange(renderDynamicText);
renderDynamicText();

function notify(key, parameters = {}, persistent = false) {
  clearTimeout(noticeTimer);
  currentNotice = { key, parameters };
  $('notice').textContent = t(key, parameters.targetId ? { ...parameters, name: t(`targets.${parameters.targetId}`) } : parameters);
  $('notice').hidden = false;
  if (!persistent) noticeTimer = setTimeout(() => { $('notice').hidden = true; }, 6500);
}
function syncReadout() {
  if (!aladin) return;
  const [ra, dec] = aladin.getRaDec();
  setTextIfChanged(readout.ra, formatDegrees(ra));
  setTextIfChanged(readout.dec, formatDegrees(dec, true));
  setTextIfChanged(readout.fov, formatFov(aladin.getFov()[0]));
  if (exploring) { viewName = { key: 'view.exploring' }; setTextIfChanged(readout.name, t(viewName.key)); }
}
function pointTo(target, title) {
  exploring = false;
  aladin.gotoRaDec(target.ra, target.dec);
  if (target.fov) aladin.setFoV(target.fov);
  viewName = title || { key: `targets.${target.id}` };
  $('view-name').textContent = viewName.literal ?? t(viewName.key);
  readoutUpdates.request();
}
function destination(target) {
  navigation++;
  searchController?.abort();
  $('search-button').disabled = false;
  pointTo(target);
  $('target').value = target.aliases[0];
  notify('notice.destination', { targetId: target.id });
}
async function search(event) {
  event.preventDefault();
  if (!aladin) return;
  const query = $('target').value.trim();
  if (!query) return;
  const request = ++navigation;
  searchController?.abort();
  try {
    const local = findTarget(query) || TARGETS.find(target => t(`targets.${target.id}`).toLocaleLowerCase() === query.toLocaleLowerCase());
    if (local) { pointTo(local); notify('notice.local', { targetId: local.id }); return; }
    const coordinates = parseCoordinates(query);
    if (coordinates) { pointTo(coordinates, { key: 'view.coordinates' }); notify('view.coordinates'); return; }
    if (!/[a-zA-ZÀ-ÿ]/.test(query)) throw uiError('errors.coordinatesInput');
    const controller = searchController = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    $('search-button').disabled = true;
    notify('notice.searching', { query }, true);
    try {
      const response = await fetch(`https://cds.unistra.fr/cgi-bin/nph-sesame/-o/SVNI?${encodeURIComponent(query)}`, { signal: controller.signal });
      if (!response.ok) throw uiError('errors.searchService');
      const position = parseSesame(await response.text());
      if (request !== navigation) return;
      pointTo(position, { literal: query });
      notify('notice.found', { query });
    } finally { clearTimeout(timer); }
  } catch (error) {
    if (request !== navigation) return;
    notify(errorKey(error));
  } finally { if (request === navigation) $('search-button').disabled = false; }
}
function surveyURL() { return SURVEYS[$('survey').value].urls[$('mirror').value]; }
function updateSurveyText() {
  const id = $('survey').value;
  $('survey-description').textContent = t(`survey.description.${id}`);
  $('view-layer').textContent = t(`survey.layer.${id}`);
  $('survey-credit').href = `${surveyURL()}/properties`;
}
async function probeSurvey() {
  surveyController?.abort();
  const controller = surveyController = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${surveyURL()}/properties`, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (!/hips_order\s*=/.test(text)) throw new Error('Metadados HiPS inválidos');
    if (controller !== surveyController) return;
    setStatus('status.hips');
  } catch {
    if (controller !== surveyController) return;
    setStatus('status.mirror');
    notify('errors.images', {}, true);
  } finally { clearTimeout(timer); }
}
function changeSurvey() {
  updateSurveyText();
  try {
    aladin.setBaseImageLayer(surveyURL());
    setStatus('status.requesting');
    probeSurvey();
  } catch (error) { console.error(error); notify('errors.layer'); }
}
function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => { script.remove(); reject(uiError('errors.connectionTimeout')); }, 18000);
    script.src = url;
    script.charset = 'utf-8';
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(uiError('errors.libraryLoad')); };
    document.head.append(script);
  });
}
async function getOfficialLibrary() {
  // URL exata oferecida pelo CDS no aviso de contingência; segunda URL fixa a mesma versão.
  const urls = ['./vendor/aladin.js', 'https://aladin.cds.unistra.fr/aladin_3.9.0-beta.js', 'https://aladin.cds.unistra.fr/AladinLite/api/v3/3.9.0-beta/aladin.js'];
  for (const url of urls) {
    try {
      await loadScript(url);
      if (window.A?.init && window.A?.aladin) return window.A;
    } catch (error) { console.warn('Aladin Lite:', url, error.message); }
  }
  throw uiError('errors.library');
}
async function boot() {
  try {
    if (!document.createElement('canvas').getContext('webgl2')) throw uiError('errors.webgl');
    const A = await getOfficialLibrary();
    let timer;
    try { await Promise.race([A.init, new Promise((_, reject) => { timer = setTimeout(() => reject(uiError('errors.wasm')), 30000); })]); }
    finally { clearTimeout(timer); }
    aladin = A.aladin('#aladin', {
      survey: surveyURL(), target: `${start.ra} ${start.dec}`, fov: start.fov,
      projection: start.projection, cooFrame: 'ICRSd', backgroundColor: '#080f1a',
      showZoomControl: false, showLayersControl: false, showGotoControl: false,
      showFullscreenControl: false, showFrame: false, showCooGrid: false,
      // Evita criar indicadores nativos duplicados e seus listeners durante a navegação.
      showFov: false, showCooLocation: false,
      showProjectionControl: false, showShareControl: false, showSettingsControl: false,
      showSimbadPointerControl: false, showCooGridControl: false,
      showReticle: true, reticleColor: '#b8efbd', reticleSize: 17,
      gridOptions: { color: '#a4c6ae', opacity: .5, labelSize: 11 },
    });
    // Sem faixa adicional: o motor oficial controla os limites de cada projeção
    // e a aproximação mínima nativa (0,1 segundo de arco nesta versão).
    catalog = A.catalog({ name: t('catalog.name'), sourceSize: 14, color: '#b8efbd', onClick: 'showPopup' });
    catalogSources = TARGETS.map(target => A.source(target.ra, target.dec, { name: t(`targets.${target.id}`), id: target.aliases[0], origem: t('catalog.origin') }));
    catalog.addSources(catalogSources);
    aladin.addCatalog(catalog);
    catalog.hide();
    aladin.on('positionChanged', ({ dragging }) => {
      if (dragging) exploring = true;
      readoutUpdates.request();
    });
    aladin.on('zoomChanged', () => readoutUpdates.request());
    $('controls').disabled = false;
    for (const id of ['search-button', 'zoom-in', 'zoom-out', 'home', 'share']) $(id).disabled = false;
    $('loading').hidden = true;
    setStatus('status.ready');
    $('engine-dot').classList.add('ready');
    readoutUpdates.request();
    updateSurveyText();
    probeSurvey();
  } catch (error) {
    console.error(error);
    $('loading').hidden = true;
    $('failure').hidden = false;
    currentFailure = error;
    $('failure-message').textContent = t(errorKey(error));
    setStatus('status.offline');
  }
}
$('search-form').addEventListener('submit', search);
$('target').addEventListener('invalid', () => { if ($('target').validity.valueMissing) $('target').setCustomValidity(t('search.required')); });
$('target').addEventListener('input', () => $('target').setCustomValidity(''));
for (const button of document.querySelectorAll('[data-target]')) button.addEventListener('click', () => destination(TARGETS.find(t => t.id === button.dataset.target)));
for (const id of ['survey', 'mirror']) $(id).addEventListener('change', changeSurvey);
$('projection').addEventListener('change', () => aladin.setProjection($('projection').value));
$('grid').addEventListener('change', () => aladin.setCooGrid({ enabled: $('grid').checked }));
$('catalog').addEventListener('change', () => $('catalog').checked ? catalog.show() : catalog.hide());
// Mesmas operações usadas pelos botões da interface oficial, com animação nativa.
$('zoom-in').addEventListener('click', () => aladin.increaseZoom());
$('zoom-out').addEventListener('click', () => aladin.decreaseZoom());
$('home').addEventListener('click', () => destination(TARGETS[0]));
$('share').addEventListener('click', async () => {
  const [ra, dec] = aladin.getRaDec();
  const url = new URL(location.href);
  url.hash = viewHash({ ra, dec, fov: aladin.getFov()[0], survey: $('survey').value, projection: $('projection').value });
  history.replaceState(null, '', url);
  try { await navigator.clipboard.writeText(url.href); notify('notice.copied'); }
  catch { notify('notice.copyFallback', {}, true); }
});
$('retry').addEventListener('click', () => location.reload());
$('about-open').addEventListener('click', () => $('about').showModal());
$('about-close').addEventListener('click', () => $('about').close());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) readoutUpdates.cancel();
  else if (aladin) readoutUpdates.request();
});
window.addEventListener('pagehide', () => readoutUpdates.cancel());
window.addEventListener('pageshow', () => { if (aladin) readoutUpdates.request(); });
updateSurveyText();
boot();
