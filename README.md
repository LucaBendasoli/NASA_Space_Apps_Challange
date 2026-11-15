# Eyelid

MVP estático para uso local. Em um terminal, rode a partir desta pasta:

```sh
python3 -m pip install astropy astropy-healpix numpy scipy requests matplotlib pillow fsspec aiohttp
python3 serve.py
```

Abra http://127.0.0.1:8765/. As imagens, o panorama SPHEREx e as fichas já estão empacotados. O servidor local consulta o IRSA e o Gaia DR3 para a área visível.

O Aladin Lite usa o mosaico SPHEREx DR1 para o céu inteiro. O service worker encaminha os blocos de cada canal ao IRSA. O fundo global requer conexão e um contexto seguro, como localhost ou HTTPS. Os recortes preparados carregam localmente. Fora deles, o visor pesquisa exposições DR1 e QR3 no centro da vista e verifica o canal por calibração espectral. O catálogo Gaia DR3 consulta até 500 fontes mais brilhantes na área. As curvas de radiância e os candidatos continuam disponíveis nos campos processados.

Para usar exposições já baixadas, inicie o servidor com
`EYELID_EPOCHS_DIR="$HOME/eyelid-data/epochs" python3 serve.py`.
Organize os arquivos como `epochs/<alvo>/cutouts/*.fits`. O arquivo original
precisa conter a extensão IMAGE, o horário de observação e a calibração
espectral WCS-WAVE. O catálogo local usa o FITS como fonte de posição,
data e faixa. O IRSA continua disponível para consultas sem cobertura local
na posição consultada. Guardar `measurements.csv` e `summary.json` permite auditar
a aquisição e usar a fotometria em uma etapa posterior.

A medição da rodada completa está em benchmark.json. Para refazer os dados, use um ambiente Python com requests, numpy, scipy, astropy, pillow, matplotlib e astropy-healpix. Execute acquire.py e process.py com o mesmo caminho de cache, depois gere os quadros e recursos Gaia antes de executar build.py.

O visor SPHEREx usa os recortes em `dist/observacoes/`. **Datas** mantém o canal e reproduz as exposições preparadas em ordem cronológica. **Canais** mantém a data e percorre a lista selecionada. O modo Mosaico DR1 oferece os 100 canais preenchidos. Os canais 51 e 52 não têm dados. Exposições individuais cobrem faixas diferentes, então combinações indisponíveis aparecem como lacunas.

Para reconstruir esses quadros, salve os resultados SIA do IRSA em VOTable, com nomes como `campo-c03-spherex_dr1.vot`, e execute `python epochs.py CAMINHO_DOS_VOTABLES CAMINHO_DO_CACHE`. O script faz uma amostragem por mês e detector, usa a calibração espectral no centro do campo e registra a procedência de cada quadro.

As fontes Gaia DR3 e os candidatos podem ser selecionados no recorte ou no Aladin Lite. A data da exposição determina a posição estimada pelas duas componentes do movimento próprio, quando disponíveis. O cálculo usa J2016.0 como referência e ignora paralaxe e velocidade radial. A curva usa o mosaico SPHEREx DR1 e fica independente da exposição exibida. Para Gaia, a abertura usa a posição estimada em J2025.75 como referência aproximada do mosaico.

O Aladin Lite 3.8.2 está em `dist/vendor/` e abre os recortes locais com WCS. Os FITS de exibição usam o contraste dos PNGs e servem para navegação. Para reconstruí-los junto com as curvas Gaia, execute `python gaia-assets.py CAMINHO_DO_CACHE` após preparar os mosaicos e exposições, e então execute `python build.py`.

**Analisar área do mapa** executa a triagem em um recorte de 6′ × 6′ centrado na vista. O servidor usa o cubo FITS do SPHEREx, os recortes WISE e o catálogo Gaia sem o limite de 500 fontes da camada visual. Os cubos ficam em cache temporário no processo. O primeiro campo de cada bloco exige baixar cerca de 107 MB, além dos recortes WISE.

As análises concluídas ficam em `.eyelid/scans/` e os candidatos voltam ao mapa ao recarregar a plataforma. Os campos preparados também aparecem no mesmo mapa. Ao voltar a um campo já analisado, o visor reutiliza seus resultados. As análises feitas pelo servidor são organizadas pela versão dos dados SPHEREx e do detector.
