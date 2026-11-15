import { createRoot } from 'react-dom/client';
import { SpectrumExplorer } from './components/spectrum-explorer';
import type { SpectrumExplorerProps } from './components/spectrum-explorer';
import styles from './styles.css';

export { SpectrumExplorer } from './components/spectrum-explorer';
export type { SpectrumExplorerProps } from './components/spectrum-explorer';
export type { CelestialObject, Observation, SpectralPoint } from './lib/spectrum';

export type SpectrumInstance = {
  /** Substitui todas as props e reinicia a seleção e os filtros. */
  update(props: SpectrumExplorerProps): void;
  destroy(): void;
};

let instance = 0;

/** Monta uma instância independente, com CSS isolado, em um contêiner vazio. */
export function mountSpectrum(host: HTMLElement, props: SpectrumExplorerProps): SpectrumInstance {
  if (host.childNodes.length) {
    throw new Error('O contêiner do gráfico precisa estar vazio.');
  }
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  if (shadow.childNodes.length) {
    throw new Error('O contêiner já possui conteúdo no Shadow DOM.');
  }

  const sheet = document.createElement('style');
  sheet.textContent = styles;
  const container = document.createElement('div');
  container.className = 'spectrum-widget';
  shadow.append(sheet, container);

  const root = createRoot(container, { identifierPrefix: `spectrum-${++instance}-` });
  let revision = 0;
  let destroyed = false;
  root.render(<SpectrumExplorer {...props} key={revision} />);

  return {
    update(next) {
      if (destroyed) throw new Error('O gráfico já foi desmontado.');
      root.render(<SpectrumExplorer {...next} key={++revision} />);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      root.unmount();
      shadow.replaceChildren();
    },
  };
}
