import { demoObjects } from './components/spectrum/examples/demo-objects.js';
import { t, getLanguage, onLanguageChange, dictionaries } from './i18n/index.js';

const dialog = document.getElementById('spectrum-dialog');
const openButton = document.getElementById('spectrum-open');
const closeButton = document.getElementById('spectrum-close');
const host = document.getElementById('spectrum-host');
const status = document.getElementById('spectrum-status');
let widget;
let pending;
let statusKey = 'spectrum.loading';

function options() {
  return {
    locale: getLanguage(),
    messages: dictionaries[getLanguage()],
    objects: demoObjects.map(object => ({
      ...object,
      name: t(`demo.${object.id}.name`),
      category: t(`demo.${object.id}.category`),
      observations: object.observations.map((observation, index) => ({
        ...observation, label: t('demo.observation', { number: index + 1 }),
      })),
    })),
    spectralRegion: t('chart.region'),
  };
}
onLanguageChange(() => {
  if (!status.hidden) status.textContent = t(statusKey);
  // Keep the same React root, selected objects, comparison mode and filters.
  widget?.update(options(), { resetState: false });
});

// O bundle do gráfico só é baixado quando o usuário abre a análise.
openButton.addEventListener('click', async () => {
  if (!dialog.open) dialog.showModal();
  if (widget || pending) return;
  status.hidden = false;
  statusKey = 'spectrum.loading';
  status.textContent = t(statusKey);
  host.hidden = true;
  try {
    pending = import('../assets/spectrum/spectrum.js');
    const { mountSpectrum } = await pending;
    widget = mountSpectrum(host, options());
    status.hidden = true;
    host.hidden = false;
  } catch (error) {
    statusKey = 'spectrum.error';
    status.textContent = t(statusKey);
    console.error('Análise espectral:', error);
  } finally {
    pending = undefined;
  }
});

closeButton.addEventListener('click', () => dialog.close());
