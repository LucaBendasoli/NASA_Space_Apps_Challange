# Órbita — estudo do Aladin Lite

Site local de exploração astronômica com interface própria e integração com o **Aladin Lite oficial do CDS**, a ferramenta de https://aladin.cds.unistra.fr/AladinLite/.

## Abrir

Você já tem Node.js neste computador. Não é necessário instalar dependências.

```powershell
cd C:\hackaton\estudo-aladin-lite
npm.cmd start
```

Abra **http://127.0.0.1:4174**. Alternativa: dê dois cliques em `iniciar.cmd` e abra o endereço mostrado. Encerre com Ctrl+C. Se a porta estiver ocupada, use `$env:PORT=4175` antes de iniciar e abra a nova porta. O servidor fica restrito ao próprio computador.

**Precisa de internet e WebGL2 para mostrar as imagens reais.** Abra por HTTP, não por duplo clique no HTML. O site tenta carregar a biblioteca local opcional e depois dois endereços oficiais da versão 3.9.0-beta. Não usa imagens fictícias para simular o mapa.

## O que foi entregue

- Interface própria, em português, com layout adaptável ao celular.
- Integração de navegação e zoom com o motor astronômico oficial, sem limite adicional de aproximação. Botões usam as operações nativas, como na interface oficial; o mínimo interno desta versão é aproximadamente 0,1 segundo de arco.
- Busca por coordenadas decimais ICRS ou nomes via Sesame.
- Oito destinos locais aproximados; M31, M42, M45 e Sirius funcionam sem resolução remota de nomes.
- DSS2, 2MASS, AllWISE e SDSS9, com dois espelhos por levantamento.
- Projeções SIN, AIT e MOL; grade; catálogo didático opcional; coordenadas e campo de visão.
- Link compartilhável que restaura posição, campo, projeção e levantamento.
- **429 arquivos originais** de código, assets, scripts, tutoriais e licenças separados em `upstream/aladin-lite/`, recuperados pelo conector GitHub e verificados byte a byte por hash Git.

Não é uma cópia idêntica da interface de contingência que a URL exibe hoje. É uma aplicação própria sobre a biblioteca oficial usada por essa ferramenta. Não houve extração de servidor privado, nem descompilação. A investigação combinou documentação, leitura dos fontes e reconstrução da interação pela API pública.

## Onde está cada parte

```text
estudo-aladin-lite/
  index.html                 Interface nossa
  src/                       CSS, integração e lógica nossos
  scripts/                   Servidor, importação e verificações nossos
  tests/                     Testes locais nossos
  docs/                      Análise e evidências em português
  upstream/
    origem.json              Origem, versão, commit e escopo do snapshot
    files.json               Manifesto com hashes de cada arquivo original
    aladin-lite/             Arquivos oficiais sem alterações
  vendor/                    Bundle opcional; não incluído inicialmente
  iniciar.cmd                Inicialização no Windows
```

Os demais diretórios de `C:\hackaton` não foram alterados. Não há instalação de pacotes ou configuração na raiz.

## Guardar a distribuição compilada localmente

```powershell
npm.cmd run vendor:runtime
```

Esse comando baixa o bundle **do endereço oficial indicado pelo CDS**, salva em `vendor/aladin.js` e registra URL, data e SHA-256 em `vendor/runtime.json`. O hash registra o download; não é uma assinatura oficial. A interface prioriza esse arquivo quando existir. O download foi tentado aqui, mas bloqueado por `EACCES` na rede do terminal. Por isso **o bundle compilado não está incluído na entrega**; os fontes estão.

Essa opção reduz a dependência do servidor da biblioteca, mas imagens HiPS, buscas de nomes não locais e fontes web continuam dependendo de rede. Fontes do sistema são usadas se o Google Fonts não responder. O bundle pode também depender de recursos externos conforme a distribuição oficial; não foi possível verificar isso nesta sessão.

Para compilar os fontes originais em outro ambiente, leia `upstream/aladin-lite/README.md` e `package.json`. O comando registrado nessa versão é `npm run build:npm`; requer instalação das dependências, Rust, alvo WebAssembly e wasm-pack. O snapshot inclui todo `src/`, assets e scripts; exemplos e testes oficiais não foram baixados. A compilação do original não foi executada aqui.

## Verificação

```powershell
npm.cmd test
npm.cmd run verify:upstream
```

Executados: **12 testes aprovados**, servidor HTTP e **429/429 hashes conferidos**. Os testes incluem compartilhamento no zoom mínimo nativo, preservação de coordenadas, indicadores em graus/minutos/segundos e agendamento de atualizações durante eventos contínuos. A sintaxe dos módulos próprios também foi verificada. Testes de parsing Sesame usam respostas de teste, não chamadas ao serviço real.

**Validação visual e renderização WebGL não executadas:** a ferramenta de navegador disponível encerrou a tentativa anterior por incompatibilidade de política de URLs com Firefox. Nenhuma tentativa de contornar essa restrição foi feita. Portanto, o funcionamento visual completo no navegador ainda precisa ser conferido; os testes aprovados não demonstram carregamento real das imagens. Veja [docs/validacao.md](docs/validacao.md).

## Limitações e evolução

O CDS publicou em 09/11/2026 um aviso de degradação dos serviços; por isso os levantamentos usam URLs diretas dos espelhos recomendados. Uma resposta válida de `properties` indica acesso aos metadados, não comprova que todos os tiles carregaram. SDSS tem cobertura parcial. A lista local é didática, não serve para astrometria precisa.

Para transformar em produto: validar no navegador com rede e WebGL2, escolher e testar uma versão estável da biblioteca, adicionar consultas de catálogo com limites de área e resultados, persistir favoritos e planejar a disponibilidade dos serviços. Não é necessário reimplementar HEALPix, projeções ou renderização para personalizar a experiência.

Análise: [arquitetura](docs/arquitetura.md) · [funcionalidades](docs/funcionalidades.md) · [origem e licenças](docs/fontes-e-licencas.md).

## Seleção de astros e infravermelho

Abra `/?science=demo` para experimentar três fontes explicitamente simuladas perto de Andrômeda. Clique nos círculos do catálogo científico ou use a lista no painel de análise. O painel oferece gráfico linear por comprimento de onda, incertezas e tabela acessível, seguindo o tema atual.

Selecionar um astro abre um painel científico flutuante não modal, sem mover a página nem redimensionar o mapa. Use **Fechar medições**, **Abrir medições** e **Ampliar**; no celular o painel aparece na parte inferior. Dados em cache aparecem imediatamente. As animações usam GSAP local e respeitam movimento reduzido; sem GSAP a interface continua funcional. Veja [apresentação animada, referências e validação](docs/apresentacao-animada.md).

Para dados reais, configure `src/science-config.js` e abra `/?science=http`. Falhas da API aparecem no painel sem fallback fictício. Consulte o [contrato provisório, exemplos e pendências de integração](docs/backend-infravermelho.md).
