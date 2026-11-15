# Largura fluida e continuidade das séries

O gráfico acompanha a largura real do painel nos modos compacto e ampliado. A ampliação horizontal para a esquerda dura 280 ms, com desaceleração `power3.out`, preservando a borda direita, a altura do painel e a vista do Aladin. Uma inversão durante a transição parte da largura visual atual. Movimento reduzido aplica o tamanho final imediatamente.

O SVG usa um `viewBox` com a largura efetiva e altura estável: 280 px no desktop, 190 px no celular e 156 px em telas baixas. Eixos, pontos, barras de incerteza e caminhos são calculados para esse espaço; o conteúdo usa a área extra em vez de permanecer centralizado na proporção original. Textos não são esticados horizontalmente. No celular, a proveniência usa uma linha com reticências e mantém o texto completo acessível, evitando que o rótulo Ampliar/Compactar mude a altura do cabeçalho.

## Continuidade e dados

- O mesmo astro principal mantém seu SVG, seus caminhos e pontos. Adicionar, remover ou trocar a comparação não reconstrói a linha principal nem repete sua animação.
- Séries são reconciliadas pela identidade `(levantamento, observação, astro)`; pontos e incertezas, pela banda; segmentos, pelas bandas consecutivas que conectam. Isso vale tanto entre astros quanto entre datas.
- Somente uma série que acaba de entrar recebe o traçado de cerca de 460 ms e a breve revelação de pontos/incertezas. Se a primeira série ainda está sendo desenhada, sua timeline continua; a nova série tem uma timeline independente.
- As escalas continuam compartilhadas e consideram as incertezas de todas as medições válidas. Quando outra série amplia os limites, eixos e coordenadas são atualizados juntos, com valores finais, sem interpolar radiâncias ou animar números científicos. A identidade e os valores originais permanecem no tooltip e na tabela.
- Abrir/reabrir o painel ou escolher outro astro principal conserva a animação completa prevista. Trocas de tema, tamanho e respostas repetidas não reiniciam traçados concluídos.
- Não há nova requisição da referência ao selecionar uma comparação. O acesso aos dados, cache, cancelamento e proteção contra respostas antigas continuam nos módulos de estado existentes.

`chart-geometry.js` isola domínios e projeção numérica. `science-chart.js` mantém nós por identidade e observa o tamanho do SVG com `ResizeObserver`. O callback usa as dimensões já fornecidas pelo observador e faz apenas cálculos e escritas de atributos, sem leituras de layout intercaladas. Os atributos só são escritos quando mudam. O observador é desconectado ao remover ou desmontar o gráfico.

`panel-presentation.js` separa a transição de largura, a entrada do painel e as timelines por série. A largura/posição CSS precisa mudar para refluir o conteúdo; usar `scaleX` deformaria textos e escalas. Essa mudança fica restrita ao painel fixo e não recalcula o tamanho do mapa. Não há nova timeline por frame, `will-change` permanente ou transformação dos valores científicos. Timelines de séries removidas são canceladas; fechamento/desmontagem e mudança de movimento reduzido limpam as animações. Sem GSAP, tamanho e dados continuam disponíveis de forma imediata.

## Verificações executadas

- `npm.cmd test`: **57 aprovados**, incluindo quatro novos casos de geometria responsiva, escala compartilhada, zero/negativos/ausências, incertezas, banda única e projeção em diferentes tamanhos.
- `npm.cmd run verify:upstream`: **429/429 arquivos preservados**; `git diff --check` sem erros de whitespace.
- Edge real com Aladin oficial e demonstração explícita: painel de aproximadamente 534→748 px de largura, sempre com 650 px de altura; SVG de 490→704 px; distância horizontal entre primeiro e último ponto de 372→567 px. Foram observadas larguras intermediárias, restauração do compacto e borda direita fixa. A geometria do mapa permaneceu idêntica.
- Expansão interrompida por uma compactação: antes e imediatamente depois da inversão, a largura foi de aproximadamente 710 px, sem salto para uma extremidade. A primeira ação foi um clique real; a inversão foi disparada no mesmo turno JavaScript para medir precisamente o antes/depois do handler.
- Adição da comparação entre astros e por data: o mesmo SVG, caminho e ponto principal permaneceram no DOM. A linha principal manteve opacidade 1, sem tracejado e **zero mutações de estilo**, enquanto a nova linha tinha `stroke-dashoffset` intermediário de aproximadamente 0,85. Remover uma comparação vazia e recuperar uma comparação do cache também preservou a referência.
- HTTP interceptado com respostas de teste e demora de 550 ms: a referência permaneceu visível durante a busca e após a chegada dos dados. O ajuste da escala não alterou o valor original no tooltip. Contadores registraram **uma chamada por conjunto**: `a@now`, `b@now` e `a@old`, mesmo removendo e selecionando novamente a comparação.
- Desktop 1440×900, viewport móvel 390×844, mudança dinâmica para movimento reduzido, alternância entre astros e datas e reversão de tamanho. No celular, o SVG ficou entre y=639 e y=829. `scrollX/scrollY` permaneceram `[0,0]`, sem rolagem automática. Não surgiram erros locais de JavaScript nem de `ResizeObserver` na execução.

Capturas: `output/playwright/fluid-chart-expanded.png`, `fluid-chart-temporal.png` e `fluid-chart-mobile.png`. Scripts de validação no mesmo diretório ignorado pelo Git. As medições foram feitas sobre a interface real; o módulo de entrada foi instrumentado em memória para observar a instância do Aladin, sem substituir o renderer.

As consultas HTTP foram simuladas, e a demonstração usa dados declaradamente fictícios. As imagens HiPS externas continuaram com falhas de DNS/timeout; o fundo das capturas está escuro. Não foram validados backend científico real, alinhamento sobre tiles carregados, aparelho físico, leitor de tela ou FPS em aparelhos de baixo desempenho. Branch mantida, sem commit ou push.
