import json,re
from shutil import copytree
from pathlib import Path
from localize import localize_markup
p=Path(__file__).resolve().parent
s=(p/'template.html').read_text().replace('lang="pt-BR"','lang="en"',1)
translations=json.loads((p/'translations.json').read_text())
for part in ('navigation', 'navigation-pages'):
 s=s.replace('<!-- '+part+' -->',(p/(part+'.html')).read_text(),1)
names={'campo-c03':'Campo do C03','campo-hercules':'Campo em Hércules','campo-leao':'Campo em Leão'}
data={k:json.loads((p/'dist'/f'{k}.json').read_text()) for k in names}
for k,v in data.items():
 v['name']=names[k]
 gaia=json.loads((p/'dist'/f'{k}-gaia.json').read_text())
 v['gaia']=gaia['sources']
 v['gaia_epoch']=gaia['epoch']
 v['radiance'].update(gaia['radiance'])
s=re.sub(r'(?<=<script id="payload" type="application/json">).*?(?=</script>)',lambda _:json.dumps(data,separators=(',',':')),s,flags=re.S)
s=s.replace('</style>', '</style><link rel="stylesheet" href="./eyelid.css">', 1)
copytree(p/'brand', p/'dist'/'brand', dirs_exist_ok=True)
(p/'dist'/'eyelid.css').write_text((p/'eyelid.css').read_text())
s=s.replace("const data=JSON.parse(document.getElementById('payload').textContent);","""const regions=JSON.parse(document.getElementById('payload').textContent);
const key=new URLSearchParams(location.search).get('regiao');
const regionKey=Object.hasOwn(regions,key)?key:'campo-c03';
const data=regions[regionKey];""")
s=s.replace("byId('both').onchange=render;byId('sort').onchange=render;render();","""byId('both').onchange=render;byId('sort').onchange=render;
const regionSelect=byId('region');
for(const [id,region] of Object.entries(regions))regionSelect.add(new Option(t(region.name),id));
regionSelect.value=regionKey;
regionSelect.onchange=()=>{const url=new URL(location.href);url.searchParams.set('regiao',regionSelect.value);location.href=url};
byId('coordinates').textContent='RA '+fmt(data.center[0],6)+'° · Dec '+fmt(data.center[1],6)+'° · 6′ × 6′';
""" + (p/'gaia.js').read_text() + """
render();""")
# Render sensible labels even when a region has no candidates.
assert 'const regions=JSON.parse' in s and 'id="object-panel"' in s

map_end='</figure></div><p class="caption">Norte'
assert map_end in s
s=s.replace(map_end,'</figure></div>'+(p/'viewer.html').read_text()+'<p class="caption">Norte',1)
s=s.replace('<p class="caption">Norte para cima no recorte. Selecione um ponto Gaia ou um candidato para abrir sua curva SPHEREx.</p>', (p/'viewer-footer.html').read_text(),1)
s=s.replace("byId('sky-image').src='data:image/png;base64,'+data.image;","")
s=s.replace('</style>',"""#sky{background:#05070c} #sky-image{image-rendering:pixelated} #sky-image[hidden],#sky.no-frame .pin,#sky.no-frame > svg{display:none}
.epoch-controls{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:9px 0}
.epoch-controls label{flex:1;display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:var(--sub)}
.epoch-controls button{background:#182538;color:var(--text);border:1px solid #41536b;border-radius:7px;padding:6px 9px;font:inherit}
.epoch-controls button:disabled{opacity:.45;cursor:default}
.channel-picker{margin:9px 0}.playlist{display:grid;grid-template-columns:repeat(auto-fit,minmax(51px,1fr));gap:5px;max-height:160px;overflow:auto}
.playlist label{display:flex;align-items:center;background:#172436;border-radius:4px;font-size:12px}
#frame-origin{color:var(--blue)} #frame-status{min-height:2.8em}</style>""",1)
s=s.replace('</style>',(p/'gaia.css').read_text()+'</style>',1)
s=localize_markup(s,translations)
s=s.replace('<title', '<script src="./i18n.js"></script><title',1)
s=s.replace('<script id="payload"', '<script>localizeMarkup()</script><script id="payload"',1)
(p/'dist'/'i18n.js').write_text('const eyelidTranslations = '+json.dumps(translations,ensure_ascii=False)+';\n'+(p/'i18n.js').read_text())
for script in ('aladin-view.js', 'spectral-tiles.js', 'navigation.js', 'object-sheet.js', 'object-spectrum.css', 'login.html', 'auth-form.js', 'account-ui.js', 'community-ui.js', 'profile-ui.js'):
 (p/'dist'/script).write_text((p/script).read_text())
s=s.replace('</html>','<script>\n'+(p/'viewer.js').read_text()+'\n</script><script src="./navigation.js"></script><script src="./account-ui.js"></script><script src="./community-ui.js"></script><script src="./profile-ui.js"></script></html>')
for asset in ('object-spectrum.js', 'object-spectrum.LICENSE.txt'):
 (p/'dist'/'vendor'/asset).write_bytes((p/'vendor'/asset).read_bytes())
(p/'dist'/'index.html').write_text(s)
