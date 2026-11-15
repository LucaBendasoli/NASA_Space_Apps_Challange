# Estados, fixação, leitura científica e links

## Uso

Por padrão `provider: 'off'` exibe **Análise não configurada**, sem lista, limpeza ou contagem fictícia de fontes. “Experimentar demonstração” ativa `?science=demo` explicitamente e abre a região inicial de Andrômeda; fontes e valores permanecem simulados. Para HTTP, configure `src/science-config.js` e use `?science=http`, conforme [contrato provisório](backend-infravermelho.md).

Estados regionais distintos: configurado/consultando, resultados, consulta sem registros, cobertura ausente, cobertura/resultados parciais, campo acima do limite e erro. Ausência de registro não é ausência física de astros. Erros da API não ativam dados fictícios.

## Fixar, desfixar, fechar e limpar

- **Fixar análise** conserva seleção, gráfico e requisição de medições durante navegação, mesmo quando a fonte não está na resposta regional ou o campo exige aproximação. O catálogo contém somente registros da resposta atual; não há marcador inventado para a seleção fixada.
- **Desfixar análise** conserva a seleção no momento do clique. A próxima consulta regional volta a aplicar o comportamento normal de manter apenas seleções retornadas.
- **Selecionar outro astro** atualiza a análise, mantendo a fixação ativa.
- **Fechar medições** oculta o painel e mantém seleção/cache/fixação; resposta posterior não o reabre.
- **Limpar seleção** remove medições e fixação, sem fechar a região de interface nem apagar o cache científico da sessão.
- Trocar levantamento ou restrição de observação invalida seleção incompatível, respostas e fixação. Trocar só o espelho não muda a identidade científica.

“Fonte fora do campo atual” deriva de `world2pix` e `getSize` públicos: posição projetada fora dos limites ou não projetável. Se a transformação falhar, a visibilidade permanece desconhecida. Ausência de uma resposta parcial tem mensagem própria e não prova que a fonte está fora da tela. O cone de consulta pode incluir fontes além do retângulo visível.

## Leitura e acessibilidade

Seleção e ação de fixação permanecem acessíveis fora da rolagem do painel. Opções mantêm nome, ID e observação para desambiguar nomes iguais. O título identifica a seleção; a procedência distingue imagem de fundo, conjunto de medições e observação. IDs e coordenadas completos ficam nos detalhes.

Tooltip próprio por mouse, foco ou toque emulado mostra banda, comprimento de onda, radiância, unidades, incerteza e qualidade fornecida. Destaca o ponto/barra e a linha correspondente, inclusive quando a tabela está recolhida. Linha sem medição não cria ponto. Escape fecha primeiro o tooltip, conservando o painel; toque/clique fora, fechamento e atualização de dados também o ocultam. A posição é limitada ao viewport; o tooltip não captura gestos. Quando a navegação de foco rola internamente a tabela/gráfico, a posição é atualizada sem rolar a página.

Ticks usam passos numéricos legíveis; a escala X permanece contínua e numérica. Zero recebe linha de referência. Gráfico continua linear e discreto, sem interpolação nem animação de valores. Tooltip e tabela mostram os valores completos fornecidos, sem arredondamento adicional. Qualidade desconhecida é exibida como recebida; não é classificada ou descartada automaticamente.

Textos auxiliares do painel usam 12 px como referência inicial em `rem`. Fonte raiz a 200% amplia controles/tabela; o SVG mantém coordenadas e tipografia em unidades próprias, escalando com seu contêiner, com valores textuais completos disponíveis no tooltip/tabela. Em paisagem baixa, a procedência longa sai do fluxo visual e permanece nos detalhes e na árvore acessível; cabeçalho, seleção e gráfico têm prioridade. Não houve alteração das timelines GSAP; movimento reduzido e contêiner estável permanecem ativos.

## Estado das imagens HiPS

`image-status.js` distingue motor inicializando/pronto/erro e camada aguardando/solicitando/preparada sem confirmação visual/erro. Os callbacks são versionados para ignorar respostas de espelhos anteriores. “Tentar outro espelho” troca somente ESA/China-VO do mesmo levantamento.

Integração conferida no snapshot original `A.js`, `HiPS.js` e `Aladin.js`, e na documentação oficial de [Aladin](https://cds-astro.github.io/aladin-lite/Aladin.html) e [HiPS](https://cds-astro.github.io/aladin-lite/HiPS.html). Usa `A.HiPS(url, {successCallback,errorCallback})` e `setBaseImageLayer`. Nesta versão, o callback de sucesso ocorre após adicionar a camada ao motor; **não comprova que todos os tiles foram baixados/pintados**. Por isso a interface diz “Imagens sob demanda · exibição não confirmada”. Não consulta `properties` à parte para fingir confirmação, não amostra pixels e não infere cobertura a partir de preto. A causa de uma região escura pode permanecer indeterminada.

## Compartilhamento

`science-share.js` mantém os campos antigos de vista (`ra`, `dec`, `fov`, `survey`, `projection`) e acrescenta, quando há seleção:

```text
objectId=object-123&objectSurvey=wise&observation=observation-456&pinned=1&dataProvider=http
```

Valida identidade, comprimento/controle dos IDs, contexto, duplicatas, coordenadas, projeção e fixação. Não inclui payloads, nomes livres, URL da API ou segredos; a geração remove credenciais e parâmetros de query não reconhecidos, mantendo somente o modo `science` explícito. `dataProvider` declara a origem esperada; **não configura nem ativa um provedor**. O provedor da configuração/query explícita precisa coincidir. Links antigos continuam restaurando somente a vista.

Abrir link válido consulta `GET objects/{id}` proposto, depois as medições, sem depender do cache anterior ou acrescentar marcador ao catálogo regional. Indisponibilidade é informada e permite tentar novamente. Configuração desligada ou incompatível tem mensagem própria. A seleção explícita do usuário prevalece sobre recuperação em voo.

## Validação executada

- `npm.cmd test`: **35 testes aprovados**. Incluem estados regionais, fixação fora da consulta, contexto incompatível, navegação durante medição pendente, visibilidade projetada, links antigos/novos/inválidos, recuperação por ID, valores completos/qualidade e callbacks antigos de imagens. Os testes existentes também cobrem fechamento e respostas fora de ordem.
- `npm.cmd run verify:upstream`: **429/429 arquivos idênticos**. `git diff --check` sem erros.
- Edge real, Aladin/WebGL reais, 1440×900, 390×844, 844×390 e 720×450 para texto ampliado. Demonstração explícita por clique, fonte A nativa clicada no canvas, fixar/navegar até outra região, compartilhar e recuperar A fora da consulta, desfixar sem apagar imediatamente, escolher B, sincronizar ponto/tabela, Escape primeiro no tooltip, limpar seleção.
- `scrollX/scrollY` iguais antes/depois da seleção. Painel/título/seletor dentro do viewport. Após ajuste de paisagem, gráfico inteiro dentro do painel (borda inferior do gráfico ~360 px, painel ~378 px em altura 390 px). Sem overflow horizontal nos tamanhos verificados.
- Temas claro/escuro e `prefers-reduced-motion` alternados; transform final `none`. Texto raiz a 200% efetivamente alterou o botão Fixar de 12 para 24 px; fechamento/fixação acessíveis, sem overflow horizontal. Isso foi emulação de ampliação tipográfica, não teste de todas as preferências de todos os navegadores.
- Arraste de mouse mudou RA; zoom e projeção MOL preservaram análise fixada. Busca local M42, grade, catálogo didático e troca de espelho exercitados. Trocar levantamento removeu o gráfico incompatível.
- **HTTP com rotas controladas no navegador**: A→B→C com atrasos diferentes deixou somente C; carregamento sem gráfico antigo; fechar durante busca permaneceu fechado; cache pronto; 503 em medições e em região, ambos recuperados por Tentar novamente. Cobertura parcial, nenhuma cobertura e consulta vazia distintos. Fonte fixada ausente da resposta, mas dentro do campo, não recebeu falso aviso de fora do campo. Recuperação por ID após nova navegação validada.
- Falha de `properties` do espelho China-VO foi simulada: callback nativo mostrou erro de camada e a identidade científica permaneceu intacta.
- Contexto separado com `hasTouch:true`/`isMobile:true`: tap no ponto abriu tooltip com qualidade e zero; tap em fechar ocultou o painel. Não é aparelho físico.
- Fonte compartilhada com HTTP 404, provedor desligado/incompatível e link legado foram verificados separadamente no navegador; resultados estão descritos no relatório de entrega.

Capturas locais ignoradas pelo Git: `output/playwright/improved-desktop-final.png`, `improved-mobile-final.png`, `improved-landscape-final.png`, `improved-text200-final.png`. Roteiros: `improvements-check.js` e `improvements-http-touch.js`. A instrumentação de observação somente expôs a instância real do Aladin para ler/provocar navegação pública; não simulou o renderer.

## Pendências e limites

Não há backend científico real conectado, validação astrométrica/científica de produção, leitor de tela ou aparelho físico nesta sessão. Rotas HTTP controladas comprovam o fluxo frontend, não a disponibilidade do serviço. API real precisa implementar o endpoint individual, fornecer nomes/procedência corretos, confirmar unidades e semântica de qualidade/incerteza e configurar CORS.

O logger externo do Aladin continuou apresentando falha DNS e o bundle local opcional Aladin não existe; o fallback remoto inicializou. Imagens HiPS são externas e podem atrasar; sucesso de camada permanece explicitamente sem confirmação de renderização. Não houve medição formal de FPS ou implantação. A comparação de dois astros foi adicionada posteriormente em [comparação de astros](comparacao-astros.md); exportação continua fora do escopo. Branch mantida; sem commit ou push.
