{
 const shell = byId('eyelid-shell');
 const navigation = byId('eyelid-navigation');
 const pages = Object.fromEntries(['map','home','profile'].map(page => [page, byId('eyelid-'+page+'-page')]));
 const collapse = byId('collapse-navigation');
 const search = byId('eyelid-sky-search');
 const query = byId('sky-search-query');
 const searchStatus = byId('sky-search-status');
 const searchToggle = byId('open-sky-search');
 const savedToggle = byId('toggle-sky-saved');
 const saved = byId('eyelid-sky-saved');
 const normalize = value => value.normalize('NFD').replace(/\p{Diacritic}/gu,'').trim().toLowerCase();
 const targets = [
  {name:'Estrela de Barnard', aliases:['Barnard','Barnard’s Star','Gl 699','Gl699'], center:[269.452083,4.693370]},
  {name:'Galáxia de Andrômeda', aliases:['Andrômeda','Andromeda Galaxy','M31','M 31'], center:[10.684793,41.269065]},
  ...Object.values(regions)
 ];

 function showPage(page, focus = true){
  for (const [name, element] of Object.entries(pages)) element.hidden = name !== page;
  for (const button of navigation.querySelectorAll('[data-page]')){
   if (button.dataset.page === page) button.setAttribute('aria-current','page');
   else button.removeAttribute('aria-current');
  }
  if (focus) (pages[page].querySelector('h1')??pages[page]).focus({preventScroll:true});
 }

 function disclosure(button, panel){
  panel.hidden = !panel.hidden;
  button.setAttribute('aria-expanded',String(!panel.hidden));
 }

 collapse.onclick = () => {
  const expanded = !shell.classList.toggle('navigation-collapsed');
  collapse.setAttribute('aria-expanded',String(expanded));
  const label = expanded ? 'Recolher navegação' : 'Expandir navegação';
  collapse.setAttribute('aria-label',label);
  collapse.title = label;
 };

 shell.addEventListener('click',event => {
  const page = event.target.closest('[data-page]')?.dataset.page;
  if (page && pages[page]) showPage(page);
  const section = event.target.closest('[data-section]')?.dataset.section;
  if (section === 'saved'){
   showPage('map');
   savedToggle.click();
  } else if (section) {
   showPage('home');
   if (section === 'contributors') byId('eyelid-contributors').focus();
   else {
    for (const tab of pages.home.querySelectorAll('[data-section]')){
     tab.setAttribute('aria-pressed',String(tab.dataset.section === section));
    }
    byId('eyelid-home-status').textContent = section === 'community'
     ? 'As discussões da comunidade serão disponibilizadas nesta seção.'
     : 'As investigações em alta aparecerão quando a comunidade começar a contribuir.';
   }
  }
 });

 const help = byId('toggle-map-help');
 const helpPanel = byId('eyelid-map-help');
 savedToggle.onclick = () => {
  if (!search.hidden) disclosure(searchToggle,search);
  if (!helpPanel.hidden) disclosure(help,helpPanel);
  disclosure(savedToggle,saved);
  if (!saved.hidden) saved.querySelector('button').focus();
 };
 saved.onkeydown = event => {
  if (event.key !== 'Escape') return;
  disclosure(savedToggle,saved);
  savedToggle.focus();
 };
 help.onclick = () => {
  if (!saved.hidden) disclosure(savedToggle,saved);
  if (!search.hidden) disclosure(searchToggle,search);
  disclosure(help,helpPanel);
 };
 searchToggle.onclick = () => {
  if (!saved.hidden) disclosure(savedToggle,saved);
  if (!helpPanel.hidden) disclosure(help,helpPanel);
  disclosure(searchToggle,search);
  if (!search.hidden) query.focus();
 };
 search.onkeydown = event => {
  if (event.key !== 'Escape') return;
  disclosure(searchToggle,search);
  searchToggle.focus();
 };

 function focusTarget(center){
  if (!aladinActive) return false;
  aladin.focus(...center);
  return true;
 }

 search.onsubmit = event => {
  event.preventDefault();
  const input = query.value.trim();
  const key = normalize(input);
  const target = targets.find(item => [item.name,...(item.aliases??[])].some(name => normalize(name) === key));
  const point = [...gaiaById.values(),...rows].find(item => normalize(item.id) === key);
  const match = /^([+-]?\d+(?:\.\d+)?)\s*°?\s*(?:[,;]\s*|\s+)([+-]?\d+(?:\.\d+)?)\s*°?$/.exec(input);
  const center = target?.center ?? (point ? [point.ra_icrs_deg ?? point.ra,point.dec_icrs_deg ?? point.dec] : match?.slice(1).map(Number));
  if (!center || center[0] < 0 || center[0] > 360 || Math.abs(center[1]) > 90){
   searchStatus.textContent = 'Digite coordenadas em graus ou use o nome de uma região ou o ID de um objeto que está no mapa.';
   return;
  }
  if (!focusTarget(center)){
   searchStatus.textContent = 'Aguarde o mapa carregar e tente novamente.';
   return;
  }
  if (point) select(point.id);
  searchStatus.textContent = '';
  disclosure(searchToggle,search);
  searchToggle.focus();
 };

 for (const target of targets.slice(0,2)){
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = target.name;
  button.onclick = () => {
   if (!focusTarget(target.center)) return;
   disclosure(savedToggle,saved);
   savedToggle.focus();
  };
  saved.querySelector('.sky-saved-options').append(button);
 }

 for (const [key, region] of Object.entries(regions)){
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = region.name;
  button.onclick = () => {
   if (key !== regionKey){
    const link = new URL(location.href);
    link.search = '';
    link.searchParams.set('regiao',key);
    location.assign(link);
   } else {
    showPage('map');
    focusTarget(region.center);
   }
  };
  byId('eyelid-region-links').append(button);
 }
}
