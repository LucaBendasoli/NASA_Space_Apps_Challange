# Análise do mesmo astro em datas diferentes

O painel tem dois rádios nativos, acima do dropdown: **Entre astros** e **Ao longo do tempo**. A abertura e cada clique explícito em uma fonte principal começam em **Entre astros**, com uma linha. No modo temporal, a referência é a observação associada ao astro clicado; o dropdown começa em **Selecione outra data para comparação**. Escolher uma data adiciona outra linha da **mesma identidade científica**, com a observação escolhida. Compara-se uma outra data por vez; o dropdown permite trocá-la ou removê-la pela primeira opção.

Os modos usam o mesmo espaço de gráfico, cores verde/roxa, escalas numéricas compartilhadas, animação de traçado, tooltip, incertezas e tabela. A posição X usa o comprimento de onda efetivo retornado em cada observação: valores diferentes entre épocas ocupam posições diferentes. Radiâncias também são lidas separadamente por observação. Não se estima evolução temporal, deslocamento espectral, interpolação ou calibração no navegador.

Alternar os rádios conserva as escolhas independentes enquanto o astro principal permanece o mesmo. Clicar novamente em um astro, inclusive o atual, ou reabrir o painel redefine o modo inicial e limpa ambas as comparações. A fixação preserva a referência durante a navegação; o histórico não depende de outras fontes permanecerem na consulta regional. Trocar levantamento ou contexto incompatível remove os dados anteriores. O link compartilhado continua recuperando apenas a seleção principal, iniciando no primeiro modo.

As datas vêm do backend. Uma data sem horário é apresentada sem inventar hora; horários são apresentados em UTC, com o timestamp original e o identificador da observação nos tooltips e na tabela. Se a referência não tiver data, a legenda informa **Data não informada**. A lista pode incluir observações com timestamps iguais e IDs diferentes; cada opção mantém o ID para distingui-las.

Selecionar uma data não troca a imagem de fundo HiPS. Essa imagem contínua pode reunir várias exposições e não deve ser identificada com uma foto única. `imageId` identifica a imagem científica vinculada à observação, acessível nos detalhes; não é uma instrução para baixar ou sobrepor uma imagem.

## Integração provisória

Não existe backend científico neste repositório. O endpoint abaixo é uma **proposta a implementar**, restrita ao adaptador `createProvider().observations`. O endpoint de medições existente no contrato provisório é reutilizado com outro `observationId`.

```http
GET {baseURL}objects/{id}/observations?surveyId=dss&referenceObservationId=obs-2025&limit=100
```

```json
{
  "id": "star-123",
  "surveyId": "dss",
  "referenceObservationId": "obs-2025",
  "complete": true,
  "nextCursor": null,
  "observations": [
    {
      "id": "star-123",
      "name": "Fonte de exemplo",
      "surveyId": "dss",
      "observationId": "obs-2023",
      "observationName": "Exposição de 2023",
      "observedAt": "2023-01-15T03:00:00Z",
      "imageId": "image-2023",
      "datasetId": "infrared-example",
      "datasetName": "Conjunto infravermelho de exemplo",
      "frame": "ICRS",
      "ra": 10.684708,
      "dec": 41.26875
    },
    {
      "id": "star-123",
      "name": "Fonte de exemplo",
      "surveyId": "dss",
      "observationId": "obs-2025",
      "observedAt": "2025-01-15T03:00:00Z",
      "imageId": "image-2025",
      "frame": "ICRS",
      "ra": 10.684708,
      "dec": 41.26875
    }
  ]
}
```

Cada registro segue o contrato de objetos e precisa ter o mesmo `id` estável do astro e `surveyId` solicitado, além de `observationId` próprio, `observedAt` e coordenadas ICRS em graus fornecidas pelo backend. A aplicação não associa exposições por nome, proximidade em RA/Dec ou pixels. Caso os IDs atuais sejam de detecções individuais, o backend precisará fornecer a associação a uma identidade persistente antes de ativar esta análise.

`observedAt` aceita `YYYY-MM-DD` ou timestamp ISO 8601 com segundos e fuso explícito (`Z` ou deslocamento); datas inexistentes, horários sem fuso e observações duplicadas são recusados. A observação de referência pode constar na lista para complementar sua data, mas é excluída do dropdown. Se ela não vier e não houver data no objeto regional, sua data permanece desconhecida. `imageId` é opcional. `observedAt` e `imageId` também são aceitos nos objetos regionais e recuperados por ID.

Para a data escolhida:

```http
GET {baseURL}objects/star-123/measurements?surveyId=dss&observationId=obs-2023
```

```json
{
  "id": "star-123",
  "surveyId": "dss",
  "observationId": "obs-2023",
  "quantity": "radiance",
  "complete": true,
  "allowNegative": true,
  "measurements": [
    {"bandId":"B1","wavelength":1.3,"wavelengthUnit":"µm","radiance":0.6,"radianceUnit":"W m⁻² sr⁻¹ µm⁻¹","uncertainty":0.15},
    {"bandId":"B2","wavelength":1.8,"wavelengthUnit":"µm","radiance":1.8,"radianceUnit":"W m⁻² sr⁻¹ µm⁻¹","uncertainty":0.15}
  ]
}
```

Valores acima são exemplos de estrutura, sem validação científica. São mantidas as regras de unidades literalmente iguais entre séries, negativos autorizados, zero, valores nulos e qualidade sem interpretação inventada. Datas não tornam medições automaticamente comparáveis: o backend deve confirmar definição da radiância, calibração entre instrumentos/épocas, bandas efetivas e significado das incertezas. Unidades incompatíveis mostram erro sem remover a referência.

`complete` é obrigatório; `complete:false` ou `nextCursor` identifica histórico parcial. A interface recebe no máximo `historyLimit` registros (100 por padrão em `science-config.js`) e não pagina automaticamente. Resultados são ordenados por data e ID, sem baixar um catálogo de todo o céu. Erros HTTP, histórico vazio e medições ausentes têm mensagens próprias; há ação para repetir. A referência permanece disponível durante essas falhas. Nenhum erro HTTP ativa a demonstração.

## Arquitetura e demonstração

- `observation-date.js`: validação e apresentação de datas.
- `science-data.js`: contrato, endpoint e payloads de demonstração explícitos.
- `science-time-state.js`: histórico, cache limitado, cancelamento e proteção contra respostas antigas, reutilizando `science-comparison.js` para medições por observação.
- `science-analysis.js`: modelo de apresentação dos dois modos, identidades das séries, rótulos e estados.
- `science.js` e `science-view.js`: fluxo e controles estáveis; um único gráfico e uma única tabela no DOM.

Ative explicitamente `/?science=demo`. A observação atual simulada é de 2025; as fontes A e B têm observações simuladas de 2023 e 2024, com comprimentos e radiâncias distintos. A época de 2024 demonstra uma banda ausente e resultado incompleto. A fonte sem medições também tem histórico vazio. Os dados não representam imagens HiPS nem evolução física comprovada.

Para conectar o serviço real, configure `baseURL`, `provider:'http'` (ou abra `?science=http`) e `historyLimit`. Implemente o endpoint proposto ou adapte apenas o provedor ao contrato definitivo. Cache de histórico e de medições é por levantamento/observação/astro e dura a sessão; versionamento/expiração e paginação interativa exigem acordo com o backend.

Também é necessário definir se `observedAt` representa início, centro ou outra referência da exposição. Timestamps civis com fuso são apresentados em UTC; escalas astronômicas como TAI/TDB, datas julianas e segundos intercalares precisam ser normalizados pelo backend antes de usar este contrato. A interface não faz conversão de escala temporal científica.

## Validação executada

- `npm.cmd test`: **53 testes aprovados**, incluindo dez novos casos de datas, identidade entre épocas, limites, ordenação, endpoint HTTP, resposta atrasada, cancelamento, cache, estados vazio/erro/parcial, unidades e separação dos modos.
- `npm.cmd run verify:upstream`: **429/429 arquivos preservados**. `git diff --check`: sem erros de whitespace.
- Microsoft Edge real, via Playwright CLI, com o Aladin oficial e observação da instância por instrumentação em memória do módulo de entrada; o renderer e os marcadores não foram mockados. Clique real em A e B; primeiro rádio e linha única na abertura; rádios acima do seletor; dropdown de datas com 2023/2024 e exclusão da referência de 2025; dois IDs de observação da mesma fonte; pontos com X diferente para comprimentos diferentes; dez bandas na tabela por observação; timestamp e ID completos no tooltip; troca de época com banda ausente; retorno à comparação entre astros preservando sua escolha; novo clique/reabertura restaurando o primeiro modo.
- Linha temporal observada em progresso (`stroke-dashoffset` aproximadamente 0,63). Temas claro/escuro, movimento reduzido, setas nativas dos rádios, Escape com foco no rádio e retorno ao botão da barra, tooltip por foco e destaque de uma única linha da tabela da época correta. Os controles não são recriados ao alternar modos.
- Desktop 1440×900 e viewport móvel 390×844. No móvel, os rádios ficaram entre y=382 e y=439, o seletor entre y=468 e y=512 e o SVG entre y=639 e y=829. Sem overflow horizontal nem alteração de `scrollX/scrollY` (`[0,0]`). O SVG móvel foi limitado a 190 px para acomodar os novos rádios e preservar o eixo inferior, mantendo os dados e a proporção.
- Em 760×390, os controles essenciais e o painel ficaram dentro do viewport; conteúdo utiliza rolagem interna. Em simulação de texto de 200% (tamanho raiz aumentado no CSS), rádios e seletor permaneceram dentro do viewport, sem overflow horizontal. Isso não equivale a teste de zoom nativo ou aparelho físico.
- Fixação e zoom mantiveram as duas épocas, sem depender de fontes regionais vizinhas. Com `provider:off`, os modos ficaram ocultos e a ativação explícita da demonstração continuou disponível.
- HTTP **interceptado com respostas de teste**, distinto da demonstração: histórico com HTTP 503, repetir, histórico parcial, requisição lenta de 850 ms, 2023→2024 com resposta antiga ignorada, unidades incompatíveis preservando a referência, fechamento durante carregamento, histórico vazio e troca de levantamento removendo dados incompatíveis. Não houve fallback para demonstração.

Capturas em `output/playwright/time-analysis-desktop.png`, `time-analysis-mobile.png`, `time-analysis-reduced.png`, `time-analysis-landscape.png` e `time-analysis-text200.png`; scripts locais de reprodução no mesmo diretório ignorado pelo Git.

As imagens HiPS externas falharam por DNS/timeout nesta sessão; as capturas mostram fundo escuro com marcadores nativos. Portanto, esta validação não comprova alinhamento sobre tiles HiPS carregados nem disponibilidade de fotos reais por data. Não houve backend científico real, aparelho físico, teste de toque ou leitor de tela. Branch mantida, sem commit ou push.
