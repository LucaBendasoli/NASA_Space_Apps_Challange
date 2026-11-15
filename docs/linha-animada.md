# Linha de apoio com traçado animado

As bandas agora são conectadas por uma linha reta de apoio visual. Marcadores discretos continuam disponíveis para tooltip e teclado; barras de incerteza, valores, unidades e posições numéricas foram preservados. A linha não representa um espectro contínuo medido e não usa suavização.

`chart-trace.js` ordena as bandas e separa sequências quando há valores ausentes ou não finitos. Só sequências de pelo menos duas medições geram caminho; uma medição isolada continua visível sem linha inventada. Bandas inexistentes no payload não são criadas nem inferidas pelo frontend.

Cada caminho SVG usa `pathLength=1`. O GSAP revela o traço por `strokeDashoffset`, com aproximadamente 460 ms de desenho após uma breve sobreposição de 40 ms com os eixos. Quando existem vários segmentos, o tempo é distribuído proporcionalmente ao seu comprimento e a ordem segue os comprimentos de onda. Nenhum valor ou posição científica é animado.

O traçado reinicia na abertura, reabertura e troca de astro, inclusive com cache. A estrutura do painel permanece estável. Fechar ou trocar rapidamente cancela a timeline anterior. Tema, redimensionamento e emissões repetidas não reiniciam a entrada. Movimento reduzido e ausência de GSAP exibem a linha completa imediatamente.

Dois detalhes de implementação asseguram suavidade: `autoRound:false` evita arredondar deslocamentos normalizados de 1 a 0 para pixels inteiros; o caminho não usa `vector-effect:non-scaling-stroke`, evitando discrepância entre o dash normalizado e a escala responsiva. O tamanho da área interativa dos marcadores foi conservado apesar da redução visual deles.

## Verificação

- `npm.cmd test`: 38 testes aprovados, incluindo ordenação sem mutação, zero/negativos, interrupção nas ausências, medições isoladas e sequência temporal limitada.
- `npm.cmd run verify:upstream`: 429/429 arquivos oficiais preservados. `git diff --check` sem erros.
- Edge com o site e dados explicitamente demonstrativos: abertura, troca A/B, reabertura com geometria idêntica, trocas rápidas, fechamento durante traçado, celular e preferência reduzida foram exercitados. Deslocamentos chegaram ao estado final zero, e a preferência reduzida removeu o dash.
- A inspeção posterior de início/meio/fim foi realizada no Edge com os módulos reais de gráfico, estado, provedor demo e apresentação carregados numa página isolada. Isso permitiu verificar o desenho sem depender da rede HiPS. No ponto intermediário (200 ms do tween), o deslocamento foi `0.6219`, com somente o trecho inicial desenhado; na troca/reabertura foram observados deslocamentos fracionários (`0.9576` e `0.9693`). Não se pausou a timeline global da aplicação no roteiro final.
- Capturas locais ignoradas pelo Git: `output/playwright/line-isolated-start.png`, `line-isolated-mid.png`, `line-isolated-end.png`, além de `line-trace-desktop.png` e `line-trace-mobile.png`. Roteiros: `line-trace-check.js` e `line-isolated-check.js`.

Na repetição após a interrupção da tarefa, servidores HiPS apresentaram timeouts/DNS e a região ficou indisponível. Portanto, a inspeção final isolada comprova o SVG e sua apresentação, não uma nova validação de imagens ou alinhamento WebGL. Não houve teste com backend científico real ou aparelho físico. Sem commit ou push.
