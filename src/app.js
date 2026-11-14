import { TARGETS, SURVEYS, findTarget, parseCoordinates, parseSesame, readView, viewHash, formatDegrees, formatFov } from './sky-model.js';
import { createFrameUpdater, setTextIfChanged } from './frame-updater.js';

const $ = id => document.getElementById(id);
let aladin, catalog, noticeTimer, searchController, surveyController, navigation = 0;
const readout = { ra: $('ra'), dec: $('dec'), fov: $('fov'), name: $('view-name') };
const readoutUpdates = createFrameUpdater(syncReadout);
let exploring = false;
const shared = readView(location.hash);
const start = shared || { ...TARGETS[0], survey: 'dss', projection: 'SIN' };
$('survey').value = start.survey;
$('projection').value = start.projection;
if (shared) $('view-name').textContent = 'Posição compartilhada';

function notify(message, persistent = false) {
  clearTimeout(noticeTimer);
  $('notice').textContent = message;
  $('notice').hidden = false;
  if (!persistent) noticeTimer = setTimeout(() => { $('notice').hidden = true; }, 6500);
}
function syncReadout() {
  if (!aladin) return;
  const [ra, dec] = aladin.getRaDec();
  setTextIfChanged(readout.ra, formatDegrees(ra));
  setTextIfChanged(readout.dec, formatDegrees(dec, true));
  setTextIfChanged(readout.fov, formatFov(aladin.getFov()[0]));
  if (exploring) setTextIfChanged(readout.name, 'Explorando o céu');
}
function pointTo(target, title) {
  exploring = false;
  aladin.gotoRaDec(target.ra, target.dec);
  if (target.fov) aladin.setFoV(target.fov);
  $('view-name').textContent = title || target.name;
  readoutUpdates.request();
}
function destination(target) {
  navigation++;
  searchController?.abort();
  $('search-button').disabled = false;
  pointTo(target);
  $('target').value = target.aliases[0];
  notify(`Destino: ${target.name}.`);
}
async function search(event) {
  event.preventDefault();
  if (!aladin) return;
  const query = $('target').value.trim();
  if (!query) return;
  const request = ++navigation;
  searchController?.abort();
  try {
    const local = findTarget(query);
    if (local) { pointTo(local); notify(`Destino local: ${local.name}.`); return; }
    const coordinates = parseCoordinates(query);
    if (coordinates) { pointTo(coordinates, 'Coordenadas ICRS'); notify('Posição ICRS selecionada.'); return; }
    if (!/[a-zA-ZÀ-ÿ]/.test(query)) throw new Error('Digite duas coordenadas em graus, separadas por vírgula ou espaço. Exemplo: 10.68, 41.27.');
    const controller = searchController = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    $('search-button').disabled = true;
    notify(`Buscando “${query}” no Sesame…`, true);
    try {
      const response = await fetch(`https://cds.unistra.fr/cgi-bin/nph-sesame/-o/SVNI?${encodeURIComponent(query)}`, { signal: controller.signal });
      if (!response.ok) throw new Error('O serviço de busca está indisponível. Use um dos atalhos ou coordenadas.');
      const position = parseSesame(await response.text());
      if (request !== navigation) return;
      pointTo(position, query);
      notify(`Objeto localizado: ${query}.`);
    } finally { clearTimeout(timer); }
  } catch (error) {
    if (request !== navigation) return;
    notify(error.name === 'AbortError' ? 'A busca demorou demais. Tente coordenadas ou um dos atalhos locais.' : error.message === 'Failed to fetch' ? 'Não foi possível acessar o Sesame. Tente coordenadas ou os atalhos locais.' : error.message);
  } finally { if (request === navigation) $('search-button').disabled = false; }
}
function surveyURL() { return SURVEYS[$('survey').value].urls[$('mirror').value]; }
function updateSurveyText() {
  const item = SURVEYS[$('survey').value];
  $('survey-description').textContent = item.description;
  $('view-layer').textContent = item.label;
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
    $('engine-status').textContent = 'HiPS acessível';
  } catch {
    if (controller !== surveyController) return;
    $('engine-status').textContent = 'Verifique o espelho';
    notify('Não foi possível confirmar o servidor de imagens. Se o mapa ficar vazio, troque o espelho. A cobertura também depende do levantamento.', true);
  } finally { clearTimeout(timer); }
}
function changeSurvey() {
  updateSurveyText();
  try {
    aladin.setBaseImageLayer(surveyURL());
    $('engine-status').textContent = 'Solicitando imagens';
    probeSurvey();
  } catch (error) { notify(`Falha ao trocar camada: ${error.message || error}`); }
}
function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => { script.remove(); reject(new Error('Tempo de conexão excedido')); }, 18000);
    script.src = url;
    script.charset = 'utf-8';
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('Falha ao carregar a biblioteca')); };
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
  throw new Error('Não foi possível baixar o Aladin Lite oficial. Verifique sua conexão com aladin.cds.unistra.fr e tente novamente.');
}
async function boot() {
  try {
    if (!document.createElement('canvas').getContext('webgl2')) throw new Error('O visualizador precisa de WebGL2. Use um navegador com suporte a WebGL2 e aceleração gráfica disponível.');
    const A = await getOfficialLibrary();
    let timer;
    try { await Promise.race([A.init, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('O motor WebAssembly não inicializou a tempo. Verifique a conexão e tente novamente.')), 30000); })]); }
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
    catalog = A.catalog({ name: 'Referências didáticas (ICRS, aproximadas)', sourceSize: 14, color: '#b8efbd', onClick: 'showPopup' });
    catalog.addSources(TARGETS.map(t => A.source(t.ra, t.dec, { name: t.name, id: t.aliases[0], origem: 'Lista didática local; coordenadas aproximadas.' })));
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
    $('engine-status').textContent = 'Motor pronto';
    $('engine-dot').classList.add('ready');
    readoutUpdates.request();
    updateSurveyText();
    probeSurvey();
  } catch (error) {
    console.error(error);
    $('loading').hidden = true;
    $('failure').hidden = false;
    $('failure-message').textContent = error.message || String(error);
    $('engine-status').textContent = 'Sem conexão com o motor';
  }
}
$('search-form').addEventListener('submit', search);
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
  try { await navigator.clipboard.writeText(url.href); notify('Link com a posição e a camada copiado.'); }
  catch { notify('A posição foi salva no endereço desta página. Copie o link na barra do navegador.', true); }
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
