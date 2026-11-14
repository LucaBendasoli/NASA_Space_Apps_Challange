# Validação — 14/11/2026

## Executado com sucesso

- Node.js disponível: 26.13.1; aplicação exige Node 22 ou superior.
- `node --test tests/*.test.mjs`: 12 testes aprovados, zero falhas.
- Servidor real iniciado em porta efêmera de loopback pelo teste, com respostas HTTP verificadas por fetch e encerramento ao final.
- Página inicial: HTTP 200 e conteúdo esperado. JavaScript: HTTP 200 e MIME correto. Licença original: HTTP 200.
- HEAD sem corpo; POST rejeitado; arquivo inexistente retorna 404; URL malformada retorna 400; escape para diretório vizinho retorna 403.
- Lógica de coordenadas: limites da esfera, polos, sinais, entradas inválidas, aliases, parsing de resposta Sesame e restauração de link.
- Regressão de zoom: round-trip numérico exato de links em 0,1 segundo de arco, campos abaixo do antigo limite e coordenadas próximas de 360°. Testadas unidades de campo em graus, minutos e segundos, incluindo o mínimo nativo sem exibir zero.
- Conferidos nos fontes oficiais os métodos públicos `increaseZoom`/`decreaseZoom` e seu uso pelos controles oficiais. A interface própria agora chama esses métodos e não configura uma faixa adicional de FoV.
- Servidor ativo em `http://127.0.0.1:4174`: resposta HTTP 200 do módulo atualizado, contendo as chamadas aos controles nativos.
- `node scripts/verify-upstream.mjs`: **429/429 arquivos idênticos aos hashes dos blobs do commit oficial**.
- `node --check` nos módulos próprios: sintaxe verificada.

Esses testes não usam um mock do renderizador para afirmar que imagens foram exibidas. A renderização não foi testada.

### Otimização da navegação

Quatro testes com relógio e agendador controlados verificam: agrupamento de uma rajada de 1.000 solicitações em uma atualização com o último estado; limitação do painel a 10 Hz em eventos contínuos com atualização final; cancelamento/retomada e ausência de loop ocioso; eliminação de escritas repetidas de texto. Os eventos sintéticos verificam o agendador próprio, não representam um benchmark do Aladin ou a frequência real de seus callbacks, que já têm throttling no original.

Os indicadores nativos de coordenadas e campo foram desativados na configuração por duplicarem os próprios. O código oficial importado não foi alterado. Sintaxe dos módulos atualizados e integridade do upstream verificadas. Não houve medição de FPS, GPU, rede ou inspeção visual; portanto não há percentual de aceleração certificado.

## Tentado e não concluído

- Downloads externos via fetch no terminal para o site oficial, npm e API GitHub falharam com `EACCES`.
- `node scripts/vendor-runtime.mjs`: falhou com `fetch failed (EACCES)`. Nenhum bundle compilado foi salvo. A obtenção dos fontes foi resolvida pelo conector oficial do GitHub, que disponibilizou os arquivos públicos com hashes.
- A ferramenta web conseguiu consultar o HTML textual do site e as páginas oficiais, mas rejeitou o conteúdo JavaScript do bundle. Isso não é evidência de que a URL esteja fora do ar no navegador do usuário.
- A tentativa de automação de Firefox no turno anterior foi encerrada pela ferramenta: política de URLs não suportada para esse navegador. Não repetimos a tentativa nem contornamos a restrição.

## Pendente no navegador

Não foram observados ou certificados nesta sessão: aparência final em desktop/celular, inicialização do WASM, imagens efetivamente desenhadas, resposta real de Sesame, clique em catálogos, gestos e troca efetiva de imagens. A revisão dos métodos contra o código oficial reduz erros de integração, mas não substitui esse teste.

Roteiro reproduzível:

1. Execute `npm.cmd start` e abra `http://127.0.0.1:4174` em um navegador com WebGL2 e internet.
2. Confirme que o painel de carregamento sai, as imagens reais aparecem e o logo Aladin Lite permanece visível.
3. Arraste e use a roda/botões: coordenadas e FoV devem mudar.
4. Busque M42 e depois `10.684708, 41.268750`: ambos dispensam Sesame.
5. Busque um objeto fora da lista, por exemplo `M81`: exige acesso ao Sesame e pode falhar durante a degradação dos serviços CDS.
6. Alterne DSS2/2MASS/AllWISE e os espelhos. Confira imagens e créditos; SDSS pode ter áreas sem cobertura.
7. Alterne projeções, grade e catálogo local; visite M31 para verificar um marcador conhecido.
8. Copie a posição e abra o link em outra aba: deve restaurar RA/Dec, FoV, projeção e levantamento.
9. Use 390 px e 1440 px de largura e confira legibilidade, teclado e acesso aos controles.

O estado “HiPS acessível” da aplicação significa somente que `properties` respondeu com um campo HiPS esperado. Não deve ser interpretado como comprovação de todos os tiles, qualidade científica ou disponibilidade futura.
