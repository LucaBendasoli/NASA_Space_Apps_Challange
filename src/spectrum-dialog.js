import { demoObjects } from './components/spectrum/examples/demo-objects.js';

const dialog = document.getElementById('spectrum-dialog');
const openButton = document.getElementById('spectrum-open');
const closeButton = document.getElementById('spectrum-close');
const host = document.getElementById('spectrum-host');
const status = document.getElementById('spectrum-status');
let widget;
let pending;

// O bundle do gráfico só é baixado quando o usuário abre a análise.
openButton.addEventListener('click', async () => {
  if (!dialog.open) dialog.showModal();
  if (widget || pending) return;
  status.hidden = false;
  status.textContent = 'Carregando análise espectral…';
  host.hidden = true;
  try {
    pending = import('../assets/spectrum/spectrum.js');
    const { mountSpectrum } = await pending;
    widget = mountSpectrum(host, {
      objects: demoObjects,
      title: 'Assinatura espectral',
      valueLabel: 'Radiância',
      radianceUnit: 'MJy/sr',
      bandCount: 102,
      spectralRegion: '5–28 μm · simulação',
    });
    status.hidden = true;
    host.hidden = false;
  } catch (error) {
    status.textContent = 'Não foi possível carregar o gráfico. Feche e abra a análise para tentar novamente.';
    console.error('Análise espectral:', error);
  } finally {
    pending = undefined;
  }
});

closeButton.addEventListener('click', () => dialog.close());
