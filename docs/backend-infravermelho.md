# Contrato provisório de infravermelho

Estes endpoints são **propostas**, não serviços existentes. Não foi encontrado backend científico neste repositório. A grandeza `radiance`, sua definição espectral/integrada e unidade científica precisam ser confirmadas pela equipe científica. Não há detecção, fotometria, conversão de magnitude/fluxo/contagens ou cálculo de radiância no frontend.

## Configuração

Execute `npm.cmd start`. Por padrão os dados científicos estão desligados. Abra `http://127.0.0.1:4174/?science=demo` para ativar explicitamente a demonstração, com três fontes simuladas perto de Andrômeda. A fonte B demonstra zero, negativo, banda ausente e resposta incompleta; a terceira não tem medições. Nenhuma delas identifica um objeto físico nos pixels HiPS.

Para HTTP, configure `baseURL` (com barra final) e, opcionalmente, `observationId` em `src/science-config.js`; abra `?science=http` ou defina `provider: 'http'` nesse arquivo. O navegador precisa de CORS no serviço externo e HTTPS quando a página usa HTTPS. Não coloque segredos nessa configuração pública. Não há fallback da API para demonstração. O espelho HiPS não participa da identidade científica.

## Consulta regional proposta

`GET {baseURL}objects?surveyId=wise&ra=10.68&dec=41.27&width=3&height=2&radius=2.5&limit=500`

Ângulos em graus ICRS. `observationId` opcional restringe observação. O backend deve mapear os IDs estáveis `dss`, `2mass`, `wise`, `sdss` aos levantamentos documentados em `src/sky-model.js` e fornecer associações científicas válidas. Uma tela HiPS não é uma fotografia individual. Cada fonte pertence a uma observação; múltiplas observações do mesmo astro podem gerar registros distintos pela chave `(surveyId, observationId, id)`.

O cone é centrado na vista, considera ambas as dimensões do FoV e bordas obtidas pela API pública `getFoVCorners(8, 'ICRS')`. Não usa intervalo cartesiano de RA: a consulta esférica atravessa 0°/360°. Em falha da projeção ou cone acima de 10°, pede aproximação. O cone pode incluir fontes fora da tela. O backend deve aplicar limites espaciais também no servidor.

```json
{
  "coverage": "full",
  "complete": true,
  "nextCursor": null,
  "objects": [{
    "id": "object-123",
    "name": "Nome opcional",
    "ra": 10.684708,
    "dec": 41.26875,
    "frame": "ICRS",
    "surveyId": "wise",
    "observationId": "observation-456"
  }]
}
```

`coverage`: `none`, `partial` ou `full`; `complete` é obrigatório. A aplicação exibe até 500 registros recebidos, não baixa páginas seguintes automaticamente. `complete:false` ou `nextCursor` informa resultado parcial e orienta restringir a região. O backend deve retornar todos os registros quando declarar `complete:true`. Paginação interativa futura exige acordo sobre estabilidade do cursor e escopo regional. Sem cobertura não significa ausência de astros no céu.

## Medições propostas

`GET {baseURL}objects/{id}/measurements?surveyId=wise&observationId=observation-456`

```json
{
  "id": "object-123",
  "surveyId": "wise",
  "observationId": "observation-456",
  "quantity": "radiance",
  "allowNegative": true,
  "complete": false,
  "measurements": [
    {"bandId":"B1", "wavelength":3.4, "wavelengthUnit":"µm", "radiance":0, "radianceUnit":"W m⁻² sr⁻¹ µm⁻¹", "uncertainty":0.1, "quality":"exemplo"},
    {"bandId":"B2", "wavelength":4.6, "wavelengthUnit":"µm", "radiance":null, "radianceUnit":"W m⁻² sr⁻¹ µm⁻¹", "quality":"sem medição"}
  ]
}
```

O payload acima ilustra a estrutura; valores e unidades não são validação científica de um levantamento real. Comprimento de onda efetivo/central positivo; a definição precisa ser uniforme e acordada com o backend. Incerteza opcional, simétrica, não negativa, na mesma unidade da radiância; sua interpretação (por exemplo 1σ) deve ser acordada. `quality` opcional é exibida sem interpretação científica. Negativos somente com `allowNegative:true`. `null`/campo ausente não vira zero. Valores não finitos, banda duplicada, coordenadas inválidas, unidade ausente, unidades diferentes na mesma resposta e identidade divergente geram erro explícito. Unidades são comparadas literalmente e devem vir uniformizadas pelo backend. A aplicação não converte grandezas. Bandas ausentes não são interpoladas. SVG linear usa pontos discretos e barras de incerteza; a tabela inclui ausências e qualidade.

Coordenadas em pixels são recusadas. O backend deve aplicar WCS válido e entregar ICRS em graus. Não existe conversão entre pixels da imagem original e pixels da tela.

## Sincronização e integração Aladin

Consultas aguardam 350 ms após mudanças efetivas de posição, zoom, projeção e tamanho (eventos de simples redesenho são ignorados). Mudanças invalidam respostas em voo imediatamente e cancelam requisições via AbortController, com timeout HTTP de 15 segundos. Trocar levantamento limpa fontes e seleção imediatamente; navegar/redimensionar preserva a seleção durante o carregamento e a reconcilia com a nova lista regional. Um contador também bloqueia respostas antigas de provedores que ignorem o cancelamento. Medições usam cache limitado a 100 chaves de astro/levantamento/observação, válido durante a sessão; dados mutáveis do backend exigirão versão de observação ou política de expiração acordada.

Catálogo próprio usa `A.catalog`, `A.source`, `addCatalog`, `removeAll`, `source.select/deselect`, callback `onClick`, cores nativas de hover/seleção e `world2pix` somente para desambiguação de vizinhos a menos de 28 pixels de tela. Nenhum marcador HTML por objeto. A lista acessível mantém todas as fontes recebidas disponíveis, inclusive em regiões densas. Sem registro não há identidade atribuída ao ponto luminoso.

APIs conferidas no snapshot local 3.9.0-beta (`Catalog.js`, `Source.js`, `Aladin.js`, `View.js`) e na [documentação oficial de catálogo](https://cds-astro.github.io/aladin-lite/Catalog.js.html) e [atlas](https://cds-astro.github.io/aladin-lite/Aladin.html). `aladin.on` tem um callback por evento nesta versão: a aplicação compartilha os eventos de posição/zoom com os indicadores existentes.

## Pendências do backend real

- Confirmar grandeza, unidades, significado de incertezas/qualidade e bandas efetivas.
- Implementar os endpoints ou adaptar somente o provedor ao contrato definitivo.
- Estabelecer mapeamento HiPS/levantamento/observação, cobertura e limites/cursor.
- Garantir coordenadas astrométricas válidas, CORS, erros HTTP e identidade/versionamento estáveis.
- Validar com observações reais; a demonstração e mocks não comprovam precisão científica nem renderização WebGL.
