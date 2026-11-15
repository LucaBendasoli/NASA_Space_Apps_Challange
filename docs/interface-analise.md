# Bancada de observação e análise

Esta etapa de layout dividido foi sucedida pelo [painel flutuante animado](apresentacao-animada.md), que preserva a dimensão do mapa ao abrir e fechar. As decisões e medidas abaixo registram a etapa anterior.

## Decisão de interface

O fluxo anterior colocava a análise depois de um mapa quase da altura da janela. Selecionar uma fonte obrigava a rolar a página e perder o contexto espacial. A bancada agora usa CSS Grid para manter imagem e medições simultâneas: mapa à esquerda, análise à direita e telemetria junto ao mapa. O Aladin permanece responsável por projeção, fontes, imagens e gestos.

A identidade existente foi mantida: DM Sans, Space Grotesk, papel claro `#f5f6f2`, tinta `#1b2a32`, céu `#080f1a`, verde `#b8efbd`, superfície escura `#1b2b35` e fundo escuro `#111b25`. Informação científica tem prioridade sobre decoração.

- **Focar no mapa / Abrir análise** recolhe ou restaura o painel sem limpar a seleção. Clicar em uma fonte reabre a análise sem deslocar a página.
- **Ampliar / Compactar** distribui mais espaço para o gráfico mantendo o mapa disponível.
- Em telas até 1100 px, os controles ficam em uma gaveta. Escape e clique fora a fecham; o foco vai à busca ao abrir e volta ao botão ao fechar. Conteúdo de fundo fica inerte enquanto a gaveta está aberta.
- Até 760 px, mapa e análise dividem verticalmente a janela. O painel tem rolagem própria e cabeçalho persistente. A página não precisa rolar entre céu e gráfico.
- Gráfico responsivo de 440 × 280 unidades SVG, rótulos numéricos compactos e unidades científicas explícitas. Não exige rolagem horizontal. Pontos continuam posicionados por comprimento de onda real, com barras de incerteza e alternativa por teclado.
- Tabela e metadados ficam em seções expansíveis. A tabela mantém sua própria rolagem horizontal quando necessário. Bandas ausentes, resultados incompletos e erros permanecem explícitos.
- Atualizações preservam foco, posição de leitura e tabela aberta. Selecionar outro astro volta ao topo somente dentro da análise, para mostrar o novo gráfico.

`src/workspace.js` controla apenas a organização visual; `science-state.js` continua responsável pelos dados. Não foram adicionados framework, biblioteca de gráfico ou dependências de aplicação. A revisão usou frontend-design e web-design-guidelines, adaptadas à identidade do projeto; Playwright foi usado para conferir o resultado real no navegador.

## Verificação

Edge com Aladin/WebGL real e provedor explicitamente demonstrativo:

- Clique na fonte nativa A exibiu seu gráfico sem rolagem da página.
- Em 1440 × 900: mapa de aproximadamente 690 × 778 px e gráfico de 419 × 267 px, ambos dentro da janela.
- Em 390 × 844: mapa de aproximadamente 370 × 321 px e gráfico de 338 × 215 px; modo ampliado mantém mapa com aproximadamente 209 px de altura.
- Seleção por teclado atualizou para B; recolher/reabrir preservou medições; tabela expandiu; gaveta abriu e fechou por Escape; temas foram alternados.
- Sem transbordamento horizontal ou vertical da página nos tamanhos acima. Capturas em `output/playwright/workspace-*.png`, incluindo `workspace-loaded.png` com imagens DSS carregadas. O roteiro local está em `output/playwright/workspace-check.js`.
- `npm.cmd test`: 22 testes. `npm.cmd run verify:upstream`: 429 arquivos oficiais preservados.

O backend científico real e toque em aparelho físico continuam pendentes. A falha DNS do logger externo do Aladin não impediu a renderização das imagens. Não se atribui validade científica aos valores de demonstração.

## Próxima evolução sugerida

Na etapa descrita neste documento, comparar dois astros ainda era uma melhoria futura. A comparação opcional entre a fonte principal e outra fonte visível foi implementada posteriormente; veja [comparação de astros](comparacao-astros.md). Validação com pesquisadores e confirmação do contrato científico real continuam pendentes.
