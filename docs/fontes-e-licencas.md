# Fontes, identidade e licenças

## Proveniência

| Fonte primária | Uso e evidência |
| --- | --- |
| [Página solicitada](https://aladin.cds.unistra.fr/AladinLite/) | URL exata indicada pelo usuário. Extração textual de controles de catálogos, VizieR e arquivo local |
| [Portal e aviso do CDS](https://aladin.cds.unistra.fr/) | Aviso atualizado em 09/11/2026; identifica a página como previewer de contingência e lista espelhos |
| [Repositório oficial](https://github.com/cds-astro/aladin-lite) | README liga diretamente à página solicitada; documentação liga ao repositório |
| [Commit importado](https://github.com/cds-astro/aladin-lite/tree/60c5cf414d6d56a10b406761e62e8c2ce9f2a760) | Snapshot fixo usado na leitura e cópia dos fontes |
| [package.json original](https://github.com/cds-astro/aladin-lite/blob/60c5cf414d6d56a10b406761e62e8c2ce9f2a760/package.json) | Nome aladin-lite, versão 3.9.0-beta, autores, repositório e licença |
| [API oficial](https://cds-astro.github.io/aladin-lite/Aladin.html) | Métodos de câmera, coordenadas, camadas e eventos |
| [Entrada da API](https://cds-astro.github.io/aladin-lite/A.html) | Inicialização, catálogos e fontes |
| [Padrão HiPS — IVOA](https://www.ivoa.net/documents/HiPS/) | Referência normativa indicada pelo projeto para aprofundamento; não alegamos auditoria integral do padrão |

O aviso do CDS aponta o arquivo [aladin_3.9.0-beta.js](https://aladin.cds.unistra.fr/aladin_3.9.0-beta.js), utilizado como primeira origem remota da demonstração. O segundo endereço segue a convenção de URL versionada documentada no README. Não usamos `latest`, para evitar mudança silenciosa de versão.

**Limite da garantia:** estes são os fontes oficiais do projeto Aladin Lite correspondente à ferramenta solicitada. Não confirmamos que o wrapper da página atual esteja incluído nesse repositório, nem que o bundle hospedado corresponda byte a byte ao commit. Versão declarada igual e vínculos oficiais comprovam a identidade do projeto, não uma equivalência de todos os artefatos publicados. O bundle não foi baixado com sucesso nesta sessão.

## O que está copiado

`upstream/aladin-lite/` contém 429 arquivos recuperados pelo conector GitHub, do commit fixo, sem alterações: todos os blobs de `src/`, `assets/`, `scripts/`, `tutorials/` e os arquivos da raiz. A raiz contém inclusive `LICENSE`, `COPYING` e `AUTHORS`. Exemplos, testes e workflows não foram incluídos. É um snapshot selecionado, não um clone Git completo; não contém histórico ou `.git`.

`upstream/files.json` guarda caminho, hash de blob Git e tamanho. `npm.cmd run verify:upstream` recalcula `SHA1("blob " + tamanho + NUL + bytes)` e compara com os hashes devolvidos pelo GitHub. Isso verifica a cópia byte a byte em relação à origem consultada. Não equivale a assinatura criptográfica dos autores.

## Licença da biblioteca

O package.json e os cabeçalhos atuais dos fontes declaram **LGPL-3.0-or-later**. `LICENSE` traz a LGPLv3 e `COPYING` contém a GPLv3 incorporada pela LGPL. A documentação histórica menciona GPLv3; por isso a licença foi aferida nos arquivos do commit importado, sem presumir que todas as versões usem a mesma licença.

Os avisos de autoria e licenças dos arquivos foram preservados. Subcomponentes de terceiros podem conter seus próprios avisos; o snapshot os mantém. A interface preserva o logo e o link produzidos pela biblioteca e também apresenta atribuição ao CDS. Não escondemos o logo por CSS.

Não modificamos nem rebatizamos o motor oficial. Em eventual redistribuição do bundle ou de uma biblioteca modificada, mantenha as licenças, a atribuição e o acesso aos fontes correspondentes e cumpra as condições aplicáveis àquela distribuição. A presente organização separa o material de terceiros, mas não substitui a leitura das licenças.

## Código e dados próprios

`index.html`, `src/`, `scripts/`, `tests/`, documentação em `docs/` e `iniciar.cmd` são trabalho novo desta demonstração. Não são apresentados como código recuperado do CDS. O motor só é usado por sua API pública.

A lista de oito objetos é um conjunto didático pequeno de posições aproximadas de objetos conhecidos, sem consulta remota na navegação local. Não é uma exportação de um catálogo do CDS. As imagens HiPS continuam nos provedores; não foram copiadas para o projeto. Créditos, referências e condições dos dados devem ser consultados no arquivo `properties` de cada levantamento, acessível pela interface.
