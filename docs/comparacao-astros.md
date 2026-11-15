# Comparação de astros no mesmo gráfico

Selecione a fonte principal clicando em seu marcador no mapa. O dropdown de seleção principal foi removido. O gráfico começa sempre com uma única série verde, correspondente à fonte selecionada. O dropdown **Comparar com outro astro visível** aparece imediatamente abaixo do título, ao lado de **Fixar análise**, no formato do seletor anterior; não exige expandir o painel nem abrir “Visualizar mais”. Ele começa em **Selecione outro astro para comparação** e adiciona uma segunda série, roxa, somente após escolha explícita. A legenda identifica o astro principal e o astro de comparação; a tabela e os tooltips identificam a mesma série e banda.

Durante o carregamento principal, o dropdown de comparação permanece visível e desabilitado. Ao abrir o painel por teclado ou pelo link de acesso rápido, o foco vai para a região rotulada, sem rolar a página. A desambiguação de marcadores sobrepostos continua sendo oferecida após o clique no mapa, para evitar atribuir medições ao astro errado.

Após o gráfico, **Tabela de medições** aparece antes de **Observação e coordenadas**. Ambas são seções permanentes com títulos acessíveis, sem controles de abrir/fechar. Quando há dados, os conteúdos ficam expostos na rolagem interna do painel, inclusive após trocar o astro ou a comparação. A tabela permanece ausente quando não há medições, e a identificação só aparece quando existe uma fonte selecionada.

O seletor inclui somente outras fontes do catálogo científico regional cuja posição projetada pelo Aladin esteja dentro da largura e altura do mapa atual. Não usa objetos didáticos nem atribui medições a pontos luminosos sem registro. Uma consulta parcial continua sendo identificada como parcial; as opções representam os registros disponíveis.

## Ciclo de seleção

- A segunda fonte só é carregada após escolha explícita. Escolher a primeira opção remove a comparação.
- Selecionar uma fonte principal, inclusive a mesma novamente, limpa a comparação. Fechar e reabrir o painel também reinicia com uma série. A fixação da análise principal mantém seu comportamento anterior.
- Navegar atualiza as opções por projeção; se a segunda fonte sair do campo ou do catálogo regional, sua comparação é removida. A fixação se aplica à análise principal.
- Trocar levantamento ou contexto incompatível remove ambas as séries. Compartilhamento continua recuperando apenas a fonte principal: comparações não são ativadas implicitamente por links.
- Erro ou ausência de medições na comparação preserva a análise principal. Há mensagem específica e ação para repetir em caso de erro.

## Dados e movimento

`science-comparison.js` mantém requisição, cancelamento, versão, cache limitado e estado da comparação separados da seleção principal. A chave do cache inclui levantamento, observação e identificador. Respostas de uma escolha anterior ou anterior à redefinição não podem restaurar uma série. Receber dados com o painel fechado não o reabre.

Ambas as séries usam os mesmos eixos numéricos, considerando valores e incertezas de todos os pontos. A comparação exige igualdade das unidades de comprimento de onda e radiância normalizadas pelo adaptador. Não há conversão automática, normalização de amplitudes nem segundo eixo enganoso. O backend deverá fornecer unidades compatíveis; o contrato e os endpoints provisórios existentes não mudam.

Cada série tem segmentos retos de apoio visual entre bandas consecutivas válidas. Ausências interrompem os segmentos; zero e negativos autorizados são preservados. A linha não representa um espectro contínuo medido. Uma única medição válida permanece isolada.

Ao adicionar ou trocar a comparação, as escalas e coordenadas são atualizadas juntas; o SVG e a linha principal permanecem no DOM. Somente a nova série é traçada, em aproximadamente 500 ms. Os pontos e incertezas aparecem nas coordenadas finais, sem animar os valores. O painel e o seletor permanecem estáveis. Movimento reduzido mostra o resultado final, inclusive quando a preferência muda durante a interação; sem GSAP, os dados permanecem visíveis. Veja [largura fluida, continuidade e validação](grafico-responsivo.md).

## Validação

Os testes de estado cobrem início sem comparação, remoção, candidatos, respostas fora de ordem, redefinição durante requisição, contexto científico, cache por observação, unidades incompatíveis, vazio, erro e repetição. A validação visual usa dados explicitamente simulados; não comprova integração com backend científico real.

Executados nesta entrega: `npm.cmd test` (**43 aprovados**), `npm.cmd run verify:upstream` (**429/429 arquivos preservados**) e `git diff --check` (sem erros de whitespace).

Em Microsoft Edge real, via Playwright CLI, foram executados:

- Clique real no marcador nativo do Aladin, primeira série isolada e placeholder exato; adição de segunda série com cores distintas e dez bandas na tabela da demonstração.
- Tooltip por foco na série de comparação destacando apenas sua linha na tabela, sem confundir bandas de mesmo identificador em astros distintos.
- Comparação vazia mantendo o gráfico principal, escolha repetida da mesma fonte principal, fechamento/reabertura e remoção pelo placeholder.
- Temas claro/escuro, mudança para movimento reduzido com painel aberto e ausência de tracejado residual.
- Desktop 1440×900 e viewport móvel 390×844. No móvel expandido, o SVG ficou entre y=555 e y=773, dentro da altura de 844 px; não houve overflow horizontal. `scrollX/scrollY` permaneceram em `[0,0]` antes/depois das seleções.
- Zoom retirando as outras fontes do campo e removendo a segunda série; retorno do zoom restaurando opções sem escolher outra fonte automaticamente. Troca SIN/AIT preservando comparação compatível; grade e catálogo didático continuam acionáveis. Em 760×390, painel limitado ao viewport com rolagem interna, sem deslocamento da página.
- HTTP **interceptado com respostas de teste**, separado da demonstração: teclado no dropdown, demora de 850 ms, B→C com resposta de B atrasada, HTTP 503 e repetir, unidades incompatíveis, fechar durante requisição e trocar levantamento. O avanço do traço foi observado em valor intermediário de `stroke-dashoffset` de aproximadamente 0,49.

Capturas em `output/playwright/comparison-desktop.png`, `comparison-dark.png`, `comparison-mobile.png`, `comparison-reduced.png` e `comparison-landscape.png`. Scripts de reprodução locais estão no mesmo diretório ignorado pelo Git.

O motor WebGL e seus marcadores foram usados de verdade, sem substituição por canvas de teste. Apenas o módulo de entrada foi instrumentado em memória para observar a instância do Aladin nos testes; nenhum renderer foi mockado. Os tiles HiPS não carregaram nesta sessão: houve falhas DNS e timeout nos serviços externos, além de mensagens de falha de fetch do bundle oficial. Portanto, as capturas mostram o fundo escuro e não validam alinhamento sobre imagens HiPS efetivamente renderizadas. Não houve teste em aparelho físico, leitor de tela ou backend científico real.

### Ajuste do seletor visível

Após remover “Selecionar fonte” e mover a comparação para a faixa fixa do painel, foram repetidos os 43 testes, a verificação dos 429 arquivos upstream e `git diff --check`, todos aprovados. No Edge, foram conferidos clique real em A, seletor de comparação imediatamente visível sem ancestral `details`, adição da segunda linha sem alterar o principal, troca de tema sem recriar o controle, clique em B reiniciando com uma série e placeholder vazio, e entrada de foco na região do painel. Em 390×844, o seletor ficou entre y=411 e y=456 e o SVG entre y=558 e y=776, sem overflow horizontal nem mudança de `scrollX/scrollY`. Capturas atualizadas: `output/playwright/direct-comparison-desktop.png` e `direct-comparison-mobile.png`. Os testes usaram a demonstração explícita; as limitações de rede e backend real continuam aplicáveis.
