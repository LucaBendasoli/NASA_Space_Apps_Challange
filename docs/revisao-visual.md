# Revisão visual — gráficos e bancada de observação

A revisão mantém HTML, módulos ES, SVG, GSAP e o motor oficial Aladin Lite. Não altera medições, contratos científicos, cache ou identidade das séries.

## Ajustes

- Título da radiância alinhado à área da grade; margem inferior separa números e título do comprimento de onda. A quantidade de ticks acompanha a altura útil. Expoentes negativos recebem margem lateral adicional.
- Legenda, contexto, gráfico e notas usam alinhamento e espaçamento consistentes. Imagem de fundo e conjunto científico continuam identificados separadamente.
- Tabela sempre aberta, com cabeçalhos íntegros, números alinhados à direita e unidades em uma segunda linha intencional. Valores completos não são arredondados. Quando as colunas não cabem, a região permite rolagem horizontal por toque ou teclado, sem alargar a página.
- Observação e coordenadas permanecem depois da tabela, sempre abertas, em uma lista de campos. IDs, coordenadas e datas ISO completos são preservados.
- Melhor legibilidade e foco da busca, controles laterais e compartilhamento. O menu móvel usa uma coluna; o cabeçalho reserva espaço real para os botões, inclusive com texto maior.
- Em paisagem baixa, controles mais compactos e gráfico com menor densidade. Detalhes permanecem em rolagem interna. Com texto muito ampliado, pode ser necessário rolar internamente até o gráfico.
- O aviso nativo de carregamento do Aladin acompanha o contraste do mapa e não sobrepõe o aviso de imagens em paisagem. Não foi modificado nenhum arquivo upstream.
- Abrir o diálogo “Sobre o projeto” ou o menu de controles não fecha involuntariamente a análise ao mover o foco.

## Validação executada

Navegador real Microsoft Edge via Playwright, com Aladin real e provedor **explicitamente demonstrativo** (`?science=demo`). A instrumentação de teste apenas expõe a instância do Aladin para localizar a fonte por `world2pix`; o clique usa o mouse sobre o canvas, sem substituir a renderização.

Foram verificadas abertura com uma série, comparação entre astros e datas, identidade do SVG e da linha principal após adicionar comparação e ampliar, tabela, metadados, diálogo, foco, Escape, teclado nos modos, menu móvel e reabertura com movimento reduzido. Viewports: 1440 × 900, 390 × 844 e 844 × 390. Texto base de 200% foi simulado alterando o tamanho raiz em CSS; isso não equivale a testar todos os mecanismos de zoom do navegador ou tecnologias assistivas.

O fluxo visual concluiu 21 verificações. Outras 9 verificaram primeiro acesso sem provedor, ação explícita de demonstração, foco da busca, busca local e por coordenadas, ativação dos controles de grade e catálogo didático, troca de espelho sem trocar levantamento, URL de compartilhamento e Escape do diálogo. A ativação desses controles não comprova disponibilidade dos tiles de imagem.

Título e gráfico ficaram no viewport móvel, e o gráfico compacto ficou dentro do painel em paisagem. `scrollX` e `scrollY` permaneceram em 0; não houve transbordamento horizontal da página. Um fixture isolado com radiâncias negativas da ordem de 10⁻¹² e comprimentos de onda pequenos verificou os limites dos rótulos SVG, sem cortes.

Capturas ficam em `output/playwright/polish-*.png`, incluindo desktop claro/escuro, ampliado, celular claro/escuro, tabela, metadados, paisagem e texto ampliado. Os scripts locais da revisão ficam no mesmo diretório ignorado pelo Git.

Os testes unitários cobrem margens, densidade da grade, escalas e preservação dos valores, além dos testes existentes de seleção, comparação e concorrência. Resultado: `npm.cmd test` — 59 testes aprovados; `npm.cmd run verify:upstream` — 429/429 arquivos intactos; `git diff --check` — sem erros.

## Limitações observadas

Servidores externos de imagens apresentaram `ERR_NAME_NOT_RESOLVED`, timeouts e respostas 404. Marcadores nativos e gráficos foram renderizados; não foi possível validar o acabamento sobre tiles HiPS carregados. Em uma sequência de redimensionamentos com as imagens indisponíveis, o Aladin informou campo vertical de 180°, acionando corretamente a proteção de consulta ampla; o teste independente de texto ampliado reinicializou a vista. Não foi introduzida uma aproximação geométrica para contornar esse estado.

Não houve teste com backend científico real, aparelho físico ou leitor de tela. Os dados demonstrativos e o fixture de eixos não comprovam integração científica em produção.
