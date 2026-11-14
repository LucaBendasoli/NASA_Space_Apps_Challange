# Funcionalidades

| Recurso | Na ferramenta pública/documentação | Na demonstração Órbita |
| --- | --- | --- |
| Imagens do céu | HiPS com níveis progressivos | Biblioteca oficial com URL direta de espelho |
| Navegação e zoom | Mouse, toque e API | Gestos originais; botões próprios acionam `increaseZoom`/`decreaseZoom`, como os controles oficiais |
| Busca por nome | Resolução astronômica remota | Oito alvos locais; demais nomes via Sesame |
| Busca por posição | API de coordenadas | Dois números decimais em graus ICRS |
| Coordenadas | Diferentes referenciais e formatos | RA/Dec centrais em graus ICRS |
| Levantamentos | Lista ampla e seleção de camadas | DSS2, 2MASS, AllWISE e SDSS9 |
| Espelhos | Página atual oferece provedores alternativos | ESA e China-VO selecionáveis |
| Projeções | Múltiplas projeções do motor | SIN, AIT e MOL |
| Grade | Grade de coordenadas | Botão liga/desliga via `setCooGrid` |
| Catálogos | SIMBAD, VizieR, locais e outros na API | Lista local de oito objetos com posições aproximadas |
| CSV e VOTable | Controles presentes na página pública | Não implementados |
| FITS, MOC e SAMP | Recursos do código/API | Não expostos nesta interface |
| Compartilhamento | API de estado e compartilhamento | Link próprio com posição, FoV, projeção e camada |

## Uso

- Digite `M31`, `M42`, `M45`, `Sirius`, `M51`, `M13`, `M1` ou `Sgr A*` para destinos locais. Nomes locais têm coordenadas aproximadas fixas, não atualizadas para movimento próprio.
- Digite `10.684708, 41.268750` ou `83.822083 -5.391111` para navegar sem resolução remota. O separador decimal é ponto; a vírgula separa os dois valores. Não há parsing próprio de coordenadas sexagesimais.
- Troque o levantamento para comparar diferentes bandas. As cores são composições dos provedores; não equivalem necessariamente às cores percebidas pelo olho humano.
- Se as imagens não aparecerem, alterne o servidor e confira o link dos metadados. SDSS não cobre todo o céu.
- Ative os objetos de referência para ver os marcadores quando estiverem no campo atual. Eles não são uma consulta do céu inteiro ao SIMBAD.
- Use “Copiar posição” para salvar o estado no link. Se a área de transferência estiver indisponível, copie o endereço da barra. O espelho, a grade e a visibilidade do catálogo não fazem parte desse estado.

## Tratamento de falhas

O site mostra estado de carregamento, falha de biblioteca/WebGL, timeout de busca e aviso de acesso ao espelho. O botão de nova tentativa recarrega a página. A confirmação de metadados não garante que as imagens de todos os níveis estejam disponíveis. Não há renderização científica alternativa offline nem cache próprio de levantamentos.

Os controles foram implementados e revisados contra a API dos fontes importados. A validação visual completa continua pendente; veja `validacao.md`.

## Aproximação e resolução

A faixa artificial de 0,01° foi removida. O motor agora determina os limites de aproximação e afastamento conforme a projeção. Nesta versão, o limite interno de aproximação é aproximadamente 0,1 segundo de arco; não se trata de zoom matematicamente infinito. Os botões usam a animação nativa do motor, e os gestos não recebem interceptação própria.

O campo exibido muda entre graus (°), minutos (′) e segundos (″) de arco. Coordenadas são exibidas com oito casas decimais; isso melhora a leitura em grande aproximação, sem aumentar a precisão dos dados originais. Links preservam a representação numérica de RA, Dec e FoV, sem arredondar campos pequenos a zero. Campos positivos vindos de links são enviados ao motor, que aplica os limites nativos.

A resolução máxima de cada levantamento continua finita. Depois do último nível de detalhe, aproximar amplia os pixels existentes. Essa alteração não acrescenta imagens de maior resolução.

## Trabalho da interface durante a navegação

As atualizações de posição e zoom solicitam um único trabalho pendente do painel, sincronizado com `requestAnimationFrame` e limitado a 10 atualizações por segundo. O estado é lido na execução para mostrar a posição mais recente, incluindo o valor final depois do movimento. Não há loop contínuo próprio quando o painel está ocioso. Os nós são referenciados uma vez e o texto só é escrito quando muda. Em aba oculta, o trabalho pendente do painel é cancelado; ao voltar, é solicitado um novo estado.

`showFov` e `showCooLocation` ficam desativados no Aladin para evitar indicadores e listeners nativos duplicados. A barra de estado original e as atribuições permanecem disponíveis. A contenção CSS do mapa e do rodapé limita a propagação de layout/pintura; os números usam largura tabular.

Essas otimizações reduzem trabalho auxiliar da interface. Não limitam os quadros do mapa a 10 FPS, não interceptam gestos, não alteram os limites de zoom, a resolução do canvas, os dados HiPS ou o motor original. Downloads de imagens ainda dependem dos espelhos e da rede. Não foi medido ganho de FPS ou tempo de GPU nesta sessão.
