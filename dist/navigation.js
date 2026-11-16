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
 const juryRegions = [
  {name:'Barnard’s Star', aliases:['Barnard','Estrela de Barnard','Gl 699','Gl699'], center:[269.452083,4.693370], fov:.09, channel:20},
  {name:'Epsilon Indi B', aliases:['ε Indi B','Eps Ind B'], description:'Par de anãs marrons', center:[331.09566,-56.80086], fov:.09, channel:20},
  {name:'WISE 0855', aliases:['WISE 0855−0714'], description:'Anã marrom de movimento rápido', center:[133.7951291667,-7.2451472222], fov:.09},
  {name:'RW Aurigae', aliases:['RW Aur'], description:'Estrela variável', center:[76.9565260346,30.4014381739], fov:.09},
  {name:'R Draconis', aliases:['R Dra'], description:'Estrela variável', center:[248.1676075,66.7549841667], fov:.09}
 ];
 const andromeda = {name:'Galáxia de Andrômeda', aliases:['Andrômeda','Andromeda Galaxy','M31','M 31'], center:[10.684793,41.269065]};
 const targets = [...juryRegions,andromeda,...Object.values(regions)];
 const mapUrl = target => '/?'+new URLSearchParams({
  ra:target.center[0],dec:target.center[1],fov:target.fov??.18,canal:target.channel??63
 });


 function showPage(page, focus = true){
  for (const [name, element] of Object.entries(pages)) element.hidden = name !== page;
  for (const button of navigation.querySelectorAll('[data-page]')){
   if (button.dataset.page === page) button.setAttribute('aria-current','page');
   else button.removeAttribute('aria-current');
  }
  if (focus) (pages[page].querySelector('h1')??pages[page]).focus({preventScroll:true});
 }

 if(openingTarget || openingQuery.get('acesso')==='jurados')showPage('map',false);

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
    document.dispatchEvent(new CustomEvent('eyelid-community-tab',{detail:section}));
   }
  }
 });

 const help = byId('toggle-map-help');
 const helpPanel = byId('eyelid-map-help');
 savedToggle.onclick = () => {
  if (!search.hidden) disclosure(searchToggle,search);
  if (!helpPanel.hidden) disclosure(help,helpPanel);
  disclosure(savedToggle,saved);
  if (!saved.hidden) savedList.querySelector('a')?.focus();
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

 const savedList = saved.querySelector('.sky-saved-options');
 const homeSaved = byId('home-saved-regions');
 function renderSavedRegions(user){
  const items = user?.role==='judge' ? juryRegions : [juryRegions[0],andromeda];
  for(const list of [savedList,homeSaved]){
   list.replaceChildren(...items.map(target=>{
    const link = document.createElement('a');
    link.href = mapUrl(target);
    link.textContent = target.name;
    if(user?.role==='judge'&&target.description){
     const description = document.createElement('small');
     description.textContent = target.description;
     link.append(description);
    }
    return link;
   }));
  }
 }
 document.addEventListener('eyelid-account-changed',event=>renderSavedRegions(event.detail));
 renderSavedRegions();
 byId('home-barnard').href = mapUrl(juryRegions[0]);
 const homeHelp = byId('home-help');
 const homeGuide = byId('home-guide');
 homeHelp.onclick = ()=>disclosure(homeHelp,homeGuide);
 byId('skip-home-guide').onclick = ()=>{
  disclosure(homeHelp,homeGuide);
  homeHelp.focus();
 };

}
