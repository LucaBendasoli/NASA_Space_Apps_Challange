# Apresentação animada das medições

Atualização: os gráficos agora incluem [linha de apoio com traçado animado](linha-animada.md), conforme a direção visual mais recente. A descrição original abaixo registra a etapa anterior de revelação apenas por pontos.

## Comportamento e arquitetura

O painel é uma única região não modal, fixa ao viewport. No desktop usa até 560 px, limitada a 46% da largura disponível do mapa, com margem de 18 px. Na abertura, `world2pix` ajuda a escolher o lado que reduz a sobreposição com a fonte; o lado permanece estável até fechar. Os controles do mapa ficam na lateral oposta. Nenhuma câmera, coordenada, FoV ou projeção é alterada para acomodar o painel.

O tamanho original é o modo compactado. **Ampliar** aumenta a largura em até 40%, com limite de 860 px e da área disponível à esquerda, mantendo borda direita, posição vertical e altura. **Compactar** restaura a geometria original. A transição dura 280 ms; o SVG aproveita toda a largura mantendo altura estável, sem distorcer textos, recriar séries existentes ou repetir sua entrada. A operação não redimensiona o Aladin nem modifica a seleção ou comparação. Veja [geometria responsiva e animação apenas das novas séries](grafico-responsivo.md).

No celular, o painel inferior tem superfície sólida, safe area, cabeçalho persistente, gráfico e rolagem interna. Quando já ocupa a largura disponível, Ampliar fica desabilitado e informa esse limite no título do botão. Tabela e detalhes permanecem acessíveis por rolagem interna. Não há arraste de painel disputando os gestos do mapa. Em paisagem baixa o gráfico é compacto, com tipografia SVG ajustada.

- `presentation-state.js`: aberto/fechado/expandido, independente das requisições.
- `panel-presentation.js`: posicionamento, origem de foco, Escape, timelines, preferência de movimento e limpeza.
- `science-panel.js`/`science-view.js`: interface estável; cabeçalho, botões, select e detalhes não são reconstruídos a cada emissão. Apenas o conjunto de dados do gráfico/tabela é substituído atomicamente, pela chave astro/levantamento/observação.
- `science-chart.js`: pontos nas coordenadas científicas finais; sem animação de valores, interpolação ou linhas entre bandas.
- `science-state.js`: cache, cancelamento e versão de requisições preservados; cache entrega pronto/vazio diretamente, sem estado intermediário de carregamento.

Selecionar abre a estrutura e atualiza o nome de forma síncrona; a busca começa no mesmo fluxo, sem aguardar a animação. O carregamento reserva o espaço do gráfico. Somente ações explícitas abrem o painel; respostas de rede nunca o reabrem. Na troca de astro, o gráfico anterior é removido antes de atualizar a área de dados. Fechar não limpa o cache; selecionar novamente a mesma fonte pode reabrir o painel.

## Movimento

GSAP **3.13.0**, servido localmente em `vendor/gsap.min.js` (~72 kB sem compressão), foi escolhido para coreografia SVG, interrupção e controle de timelines. Não há framework ou plugins GSAP adicionais. Origem, versão e SHA-256 estão em `vendor/gsap-runtime.json`; README e referência de licença foram preservados no mesmo diretório. Os manifests e fontes do Aladin não foram modificados.

- Desktop: 270 ms, deslocamento horizontal de 20 px e opacidade, `power3.out`.
- Celular: 340 ms, deslocamento vertical de 28 px e opacidade.
- Fechamento: 180 ms. Conteúdo: 150 ms, seguido de eixos e marcas com pequenas sobreposições; revelação termina em aproximadamente 370 ms.
- Pontos e incertezas: somente opacidade, na posição final; nenhuma mudança simulada de radiância.
- Interromper a entrada/saída mata o tween anterior e continua do estado visual atual. `will-change` existe apenas durante o movimento do contêiner. Não há leitura/escrita de layout a cada frame nem resize contínuo do Aladin.
- `gsap.matchMedia` acompanha breakpoint e movimento reduzido. A troca da preferência encerra o movimento e revela o estado final sem sequência escalonada. Sem GSAP, a apresentação é imediata e funcional.

## Acessibilidade

Região rotulada pelo título do astro, sem foco aprisionado ou backdrop no céu. “Abrir medições” e o link “Ir para a análise” oferecem entrada por teclado com `preventScroll`. Fechar medições, Ampliar/Compactar e tabela são controles nativos. Escape não é interceptado em select/input, dialog prioritário ou gaveta de controles. Ao fechar com foco interno, retorna à origem válida ou ao botão da barra de ferramentas para seleções no canvas. O painel fechado fica `inert`, oculto da árvore acessível e sem captura de cliques. Anúncios curtos de seleção, carregamento e erro ficam separados do SVG e da tabela.

## Referências consultadas e adaptação

- [Apple HIG — Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets): uma apresentação contextual não modal, adaptada ao navegador; não se replica a modalidade padrão dos sheets de macOS.
- [Vaul / Building a drawer component](https://emilkowal.ski/ui/building-a-drawer-component) e [7 Practical Animation Tips](https://emilkowal.ski/ui/7-practical-animation-tips): resposta imediata, desaceleração e movimento breve; sem dependência React nem arraste nesta implementação.
- [Carbon — Choreography](https://www.carbondesignsystem.com/building-blocks/foundations/motion/choreography) e [Simple Charts](https://www.carbondesignsystem.com/building-blocks/data-visualization/simple-charts): hierarquia e revelação curta, sem transformar bandas discretas em um espectro contínuo.
- [Bostock — Object Constancy](https://bost.ocks.org/mike/constancy/): identidade científica explícita e contêiner estável; escalas, pontos e título trocam como um conjunto coerente.
- [Radix Popover](https://www.radix-ui.com/primitives/docs/components/popover): limites do viewport, origem de foco e apresentação não modal, sem instalar Radix.
- [W3C — Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) e [Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html): preferência de movimento em tempo real e acesso por foco.
- [gsap.matchMedia](https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/): gerenciamento de condições e limpeza das animações.

Skills aplicadas: frontend-design, gsap-core, gsap-timeline, gsap-performance, svg-animation e accessible-animation. Playwright CLI foi usado para os testes de navegador.

## Validação executada

Edge real, Aladin 3.9.0-beta e WebGL reais, branch `feat/selecao-astros-infravermelho`, sem commit ou push:

- `npm.cmd test`: **25 testes aprovados**, incluindo apresentação independente, fechamento durante carregamento, cache sem loading e resposta antiga após fechar/reabrir para outra identidade.
- `npm.cmd run verify:upstream`: **429/429 arquivos preservados**. `git diff --check` sem erros de whitespace.
- Demonstração explícita: clique no marcador nativo A, seleção de B por teclado, fonte sem medições, reabrir a mesma fonte, expansão e tabela. Referências dos botões permaneceram idênticas entre atualizações.
- Ao selecionar: `scrollX/scrollY` iguais antes/depois; RA/Dec/FoV iguais antes/depois da abertura. Painel, título e gráfico dentro do viewport em **1440×900**, **390×844** e **844×390**, sem overflow horizontal.
- Escape com foco no botão de fechar retornou o foco à barra. Fechamento durante entrada manteve o painel fechado. Alteração de reduced-motion com painel aberto resultou em `transform: none`. Temas claro e escuro exercitados.
- Zoom, projeção MOL e arraste mantiveram navegação e lado do painel estável. Trocar levantamento limpou o gráfico incompatível; trocar só o espelho preservou a identidade.
- HTTP **com respostas controladas no navegador**, não backend real: A (900 ms), B (550 ms), C (120 ms); após A→B→C somente C e sua chave estavam no gráfico. Durante a troca para A, título A e placeholder sem gráfico antigo. Fechar antes da resposta permaneceu fechado após chegar; reabrir usou cache pronto. HTTP 503 mostrou erro; Tentar novamente recuperou os dados. Cobertura parcial foi preservada.
- Recurso GSAP bloqueado deliberadamente: seleção e gráfico continuaram utilizáveis.

Roteiros e capturas locais, ignorados pelo Git: `output/playwright/animated-panel-check.js`, `panel-network-check.js`, `animation-mid.png`, `animated-desktop.png`, `animated-mobile.png`, `animated-landscape.png` e capturas `*-final.png`. As verificações com instrumentação expuseram apenas a instância real do Aladin para ler `world2pix` e câmera; não simularam o renderer.

## Limites observados

Sem backend científico real, aparelho móvel físico ou leitor de tela nesta sessão. O celular foi validado por viewport; a preferência reduzida foi emulada e alternada ao vivo. A captura de vídeo foi tentada, mas o Playwright não encontrou `ffmpeg-win64.exe`; foram entregues capturas estáticas, incluindo momento intermediário da revelação.

As imagens HiPS externas apresentaram latência (um `Allsky.jpg` levou aproximadamente 26 s, terminando com HTTP 200). Algumas capturas mostram apenas fontes sobre fundo preto enquanto a imagem carregava. O logger remoto do Aladin falhou por DNS e o bundle opcional local Aladin estava ausente, com fallback oficial ativo. Não houve bloqueio de WebGL; isso não comprova qualidade científica nem disponibilidade permanente de HiPS. Uma navegação `waitUntil: load` do roteiro precisou ser substituída por `domcontentloaded` devido aos recursos externos. Não foi feita medição formal de FPS.
