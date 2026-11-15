# SpectrumExplorer

Explorador espectral reutilizável em React com SVG nativo, comparação de astros e observações, filtro de comprimento de onda, tooltip e exportação CSV. A biblioteca não depende do Next.js nem do motor do Aladin.

## Usar em JavaScript

O bundle pronto está em `assets/spectrum/spectrum.js` e inclui React, os ícones utilizados e os estilos. Ele é carregado sob demanda pelo botão **Análise espectral** do Alladin.

```js
import { mountSpectrum } from './assets/spectrum/spectrum.js';

const options = {
  title: 'Meu espectro',
  valueLabel: 'Fluxo',
  radianceUnit: 'mJy',
  bandCount: 2,
  spectralRegion: '0,8–2 μm',
};

const chart = mountSpectrum(document.getElementById('meu-grafico'), {
  ...options,
  objects: [{
    id: 'astro-1',
    name: 'Meu astro',
    category: 'Estrela',
    color: '#9d8bff',
    observations: [{
      id: 'astro-1-obs-1',
      date: '2026-10-12T00:00:00Z',
      label: 'Espectro de referência',
      points: [
        { wavelength: 0.8, radiance: 0.025 },
        { wavelength: 2, radiance: 0.016 },
      ],
    }],
  }],
  onRangeChange: ([min, max]) => console.log(min, max),
});

// Substitui TODAS as props e reinicia seleção, modo e filtros.
// chart.update({ ...options, objects: novosObjetos });

// Antes de remover o contêiner ou quando o widget deixar de ser usado:
// chart.destroy();
```

Use um contêiner vazio como `<div id="meu-grafico"></div>`. Cada instância possui seu próprio Shadow DOM, seus estilos escuros e identificadores SVG. Não importe `styles.css` globalmente. `destroy()` é idempotente; depois dele é possível montar outra instância no mesmo contêiner. Fechar o diálogo do Alladin preserva a instância e sua seleção.

## Usar em React

O componente e seus tipos estão em `components/spectrum-explorer.tsx` e `lib/spectrum.ts`. Também são exportados por `index.tsx`. O componente React puro usa as mesmas props abaixo; nessa forma o consumidor é responsável por aplicar `styles.css` e fornecer o contêiner `.spectrum-widget`. Para obter o isolamento de CSS automaticamente, use `mountSpectrum` em um contêiner gerenciado por um efeito React e chame `destroy` no cleanup.

## Dados e propriedades

```ts
type SpectralPoint = { wavelength: number; radiance: number };
type Observation = {
  id: string;
  date: string;
  label: string;
  points: SpectralPoint[];
};
type CelestialObject = {
  id: string;
  name: string;
  category: string;
  color: string;
  observations: Observation[];
};
```

| Propriedade | Descrição / padrão |
| --- | --- |
| `objects` | Lista de astros, obrigatória; `[]` mostra estado vazio. |
| `locale` | Idioma das datas e números; padrão `pt-BR`. |
| `messages` | Catálogo de rótulos `chart.*`; o padrão mantém os textos em português. |
| `title` | `Assinatura espectral`. |
| `valueLabel` | Nome da grandeza no eixo Y; `Radiância`. |
| `radianceUnit` | Unidade exibida no eixo Y; `MJy/sr`. Não converte valores. |
| `bandCount` | Quantidade exibida no selo; `102`. Não cria pontos. |
| `spectralRegion` | Descrição da cobertura; `Infravermelho médio`. |
| `onRangeChange` | Callback opcional com `[mínimo, máximo]` em μm. |

Use IDs únicos, datas ISO válidas e comprimentos de onda em μm. Todas as séries devem usar a mesma grandeza/unidade. O campo `radiance` também pode transportar fluxo, desde que os rótulos sejam ajustados. Em **Comparar astros**, a primeira observação de cada astro é a referência; em **Comparar observações**, todas as observações do astro escolhido ficam disponíveis. Pontos isolados são desenhados como círculos. Valores não finitos são excluídos e os pontos são ordenados sem alterar os dados recebidos.

Para atualizar apenas o idioma e os rótulos sem reiniciar a seleção e os filtros, use `chart.update(novasProps, { resetState: false })`. O comportamento padrão de `update(novasProps)` continua reiniciando o estado para um novo conjunto de dados.

O gráfico não consulta APIs nem extrai espectros de HiPS/FITS. A aplicação fornece os dados e controla paginação/seleção do catálogo. Prefira conjuntos limitados, como os 100 objetos por página do projeto de origem.

## Demonstração no Alladin

`examples/demo-objects.js` contém três curvas sintéticas com 102 pontos entre 5 e 28 μm em três datas. São exemplos de interface, sem relação científica com os objetos ou com a posição do mapa. A interface identifica explicitamente essa simulação. Para integrar uma API, substitua os dados passados em `src/spectrum-dialog.js` ou chame `update` quando os novos dados chegarem.

## Desenvolvimento

Na raiz do repositório, com Node.js 22 ou superior:

```powershell
npm.cmd ci
npm.cmd run typecheck:spectrum
npm.cmd run build:spectrum
npm.cmd test
npm.cmd run verify:upstream
npm.cmd start
```

O build gera `assets/spectrum/spectrum.js`, seu arquivo `.LEGAL.txt` e `THIRD_PARTY_LICENSES.txt`, com os textos completos das licenças distribuídas. Esses artefatos devem acompanhar o commit: o servidor é estático e `npm.cmd start` não compila TypeScript. O bundle é autossuficiente; não precisa servir `node_modules`. Depois de editar os fontes ou o CSS, gere o bundle novamente. O alvo é ES2022; use navegadores modernos com módulos, Shadow DOM e `<dialog>`.

Os arquivos oficiais em `upstream/aladin-lite/` não fazem parte desse componente. As dependências e suas versões resolvidas estão em `package-lock.json`; avisos de licença do bundle ficam em `assets/spectrum/spectrum.js.LEGAL.txt`.
