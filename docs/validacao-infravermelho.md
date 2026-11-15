# Validação da seleção e infravermelho

Executada em 14/11/2026 (horário de São Paulo).

- `npm.cmd test`: 22 testes aprovados, incluindo 10 novos testes do contrato, estado assíncrono, catálogo e provedor HTTP.
- `npm.cmd run verify:upstream`: 429/429 arquivos oficiais preservados.
- Navegador real: Microsoft Edge via Playwright CLI, desktop 1366 × 900 e viewport móvel 390 × 844. Sem simulação de WebGL ou do motor Aladin.

## Demonstração no navegador

Clique de mouse em fonte nativa abriu o gráfico de A; seleção de B atualizou gráfico e tabela. Conferidos ausência de bandas, zero, negativo autorizado, resultados incompletos e fonte sem medições. Seleção via teclado no select (Home, setas, Enter) atualizou o valor e o painel. Grade, catálogo didático e compartilhamento continuaram operacionais. Busca local M42 levou à região sem cobertura demonstrativa.

Conferidos cliques após zoom, projeções AIT/MOL, arraste e redimensionamento. Para a checagem final, uma interceptação somente do módulo próprio `app.js` no navegador expôs a instância real do atlas ao roteiro de teste. Usou-se `world2pix` público para determinar o ponto clicado antes/depois dos gestos; o arraste moveu a posição projetada e o clique na nova posição abriu as medições do mesmo ID. Nenhum dado do catálogo ou renderização foi simulado nesse teste. O roteiro temporário está em `output/playwright/validate.js` (artefato local ignorado pelo Git).

Trocar levantamento limpou gráfico e seleção; trocar somente espelho manteve ID/observação/levantamento. Temas claro e escuro foram alternados com gráfico aberto; resize manteve gráfico compatível. Não houve transbordamento horizontal da página no viewport móvel; gráfico e tabela têm rolagem horizontal própria para manter eixos e valores legíveis. Capturas locais em `output/playwright/` incluem `desktop-chart.png`, `mobile-chart.png` e `mobile-final.png`.

## HTTP e limites da validação

Em `?science=http`, a URL base padrão sem serviço retornou HTTP 404; o painel mostrou erro e botão de tentar novamente, sem fontes fictícias. Falhas e repetição de requisições de medições também têm testes unitários. Isso valida a apresentação de falha, **não uma integração com backend científico real**.

O bundle local opcional `vendor/aladin.js` estava ausente (404 esperado); o fallback oficial remoto carregou a versão configurada e as imagens DSS foram renderizadas. O logger externo do Aladin apresentou falha DNS; isso não impediu esses testes. Não houve bloqueio de WebGL.

Não foram validados: medidas científicas reais, serviço científico/CORS de produção, autenticação futura, precisão astrométrica de observações reais, pesquisa remota Sesame, leitor de tela ou toque em aparelho físico. O celular foi validado por viewport; a entrada por teclado e os cliques usaram o navegador desktop. A desambiguação tem teste de catálogo com fontes próximas; ainda merece teste com catálogo científico denso real.
