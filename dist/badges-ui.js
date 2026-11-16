const badgeCatalog = new Map(badgeDefinitions.map(([id,en,pt,description,descricao,total])=>[
 id,{id,name:language==='en'?en:pt,criterion:language==='en'?description:descricao,total}
]));
const badgeImage = id => './brand/badges/'+id+'.png';

async function badgeRequest(endpoint,body){
 const response=await fetch('/api/badges/'+endpoint,{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
 });
 if(!response.ok)throw Error(response.status);
 return response.json();
}

{
 let member=null;
 const pending=new Map();
 const sent=new Set();
 async function flush(){
  if(!member)return;
  const account=member;
  for(const [key,event] of pending){
   if(sent.has(key))continue;
   sent.add(key);
   pending.delete(key);
   badgeRequest('activity',event).catch(()=>{
    if(member===account){sent.delete(key);pending.set(key,event)}
   });
  }
 }
 function record(event){
  const key=JSON.stringify(event);
  if(sent.has(key))return;
  pending.set(key,event);
  flush();
 }
 document.addEventListener('eyelid-account-changed',event=>{
  const next=event.detail?.role==='member'?event.detail.id:null;
  if(next!==member){
   if(member)pending.clear();
   sent.clear();
  }
  member=next;
  if(event.detail?.role==='judge')pending.clear();
  flush();
 });
 document.addEventListener('eyelid-object-opened',()=>record({action:'open'}));
 document.addEventListener('eyelid-band-observed',event=>record({action:'observe',...event.detail}));
}

function renderProfileBadges(profile,refreshFavorite){
 const root=byId('profile-badges');
 const state=profile.badges;
 const favorite=badgeCatalog.get(state?.favorite);
 const highlight=byId('favorite-badge');
 highlight.replaceChildren();
 highlight.hidden=!favorite;
 if(favorite){
  const image=document.createElement('img');
  image.src=badgeImage(favorite.id);
  image.alt='';
  const name=document.createElement('span');
  name.textContent=favorite.name;
  highlight.append(image,name);
 }
 root.replaceChildren();
 const grid=document.createElement('div');
 grid.className='badge-grid';
 const label=document.createElement('p');
 label.className='badge-status';
 label.setAttribute('role','status');
 if(profile.profile.role==='judge')label.textContent=t('Insígnias de exemplo para a demonstração.');
 else if(profile.own&&!profile.editable)label.textContent=t('Use uma conta pessoal para conquistar insígnias.');
 root.append(label,grid);
 for(const badge of badgeCatalog.values()){
  const value=state?.progress[badge.id]??0;
  const earned=value>=badge.total;
  const card=document.createElement('section');
  card.className='badge-card';
  card.dataset.badge=badge.id;
  card.dataset.earned=String(earned);
  const image=document.createElement('img');
  image.src=badgeImage(badge.id);
  image.alt='';
  image.loading='lazy';
  const title=document.createElement('h3');
  title.textContent=badge.name;
  const description=document.createElement('p');
  description.textContent=badge.criterion;
  const progress=document.createElement('progress');
  progress.max=badge.total;
  progress.value=value;
  progress.setAttribute('aria-label',badge.name+' · '+t('Progresso'));
  const counts=document.createElement('span');
  counts.textContent=state?.awarded?.includes(badge.id)?t('Concedida'):earned?t('Conquistada'):value+' / '+badge.total;
  card.append(image,title,description,progress,counts);
  if(profile.editable&&earned){
   const button=document.createElement('button');
   const pinned=badge.id===state.favorite;
   button.type='button';
   button.textContent=pinned?t('Remover destaque'):t('Destacar no perfil');
   button.onclick=async()=>{
    const controls=[...grid.querySelectorAll('button')];
    controls.forEach(control=>control.disabled=true);
    try{
     const badges=await badgeRequest('favorite',{badge:pinned?null:badge.id});
     refreshFavorite(badges,badge.id);
    }catch{
     label.textContent=t('Não foi possível salvar o destaque.');
    }finally{controls.forEach(control=>control.disabled=false)}
   };
   card.append(button);
  }
  grid.append(card);
 }
 if(state?.saved_rgb?.length){
  const saved=document.createElement('div');
  saved.className='badge-saved-views';
  const heading=document.createElement('h3');
  heading.textContent=t('Vistas em falsa cor salvas');
  saved.append(heading);
  for(const view of state.saved_rgb){
   const link=document.createElement('a');
   link.href='/?'+new URLSearchParams(view);
   link.textContent=t('Abrir vista')+' · RGB '+view.rgb.replaceAll(',',' / ');
   saved.append(link);
  }
  root.append(saved);
 }
}
