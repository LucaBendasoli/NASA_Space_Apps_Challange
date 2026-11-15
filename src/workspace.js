import { createPanelPresentation } from './panel-presentation.js';
// Gaveta de controles e painel científico têm ciclos independentes.
export function setupWorkspace() {
  const main = document.querySelector('main');
  const presentation = createPanelPresentation(document.getElementById('science-panel'));
  const controls = document.getElementById('controls-toggle');
  const sidebar = document.querySelector('.sidebar');
  const compact = matchMedia('(max-width: 1100px)');
  function showControls(show) {
    document.body.classList.toggle('controls-open', show);
    controls.setAttribute('aria-expanded', String(show));
    sidebar.inert = compact.matches && !show;
    main.inert = compact.matches && show;
    if(compact.matches && show) sidebar.querySelector('#target').focus({preventScroll:true});
  }
  controls.addEventListener('click', () => showControls(controls.getAttribute('aria-expanded') !== 'true'));
  document.getElementById('controls-dismiss').addEventListener('click', () => { showControls(false); controls.focus(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !document.querySelector('dialog[open]') && document.body.classList.contains('controls-open')) { showControls(false); controls.focus(); }
  });
  compact.addEventListener('change', () => showControls(false));
  showControls(false);
  return { presentation };
}
