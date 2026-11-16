{
 const endpoint = '/api/community/posts';
 const home = byId('community-home');
 const mapFeed = byId('community-map');
 let view, user;
 document.addEventListener('atlas-coverage',event=>{view=event.detail});

 function element(tag,text,css){
  const node = document.createElement(tag);
  if(text)node.textContent = text;
  if(css)node.className = css;
  return node;
 }

 async function request(path, body){
  const response = await fetch(path,body ? {
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
  } : {cache:'no-store'});
  if(!response.ok)throw Error(String(response.status));
  return response.json();
 }

 function avatar(name,url){
  const initials = name?.trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase() || '◉';
  const badge = element('span',initials,'community-avatar');
  badge.setAttribute('aria-hidden','true');
  if(url){
   const image = element('img');
   image.alt = '';
   image.src = url;
   image.onerror = ()=>image.remove();
   badge.append(image);
  }
  return badge;
 }

 function icon(path){
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 24 24');
  svg.setAttribute('aria-hidden','true');
  const shape = document.createElementNS(ns,'path');
  shape.setAttribute('d',path);
  svg.append(shape);
  return svg;
 }

 function showDraft(send,{attach=false,reply=false,fromMap=false}={}){
  const form = element('form',null,'community-compose');
  const field = element('textarea');
  field.required = true;
  field.maxLength = 2000;
  field.rows = 2;
  field.placeholder = reply?t('Escreva uma resposta'):t('O que você observou?');
  field.setAttribute('aria-label',field.placeholder);
  const option = element('label',t('Anexar a vista atual do céu'),'community-attach');
  const check = element('input');
  check.type = 'checkbox';
  check.checked = fromMap;
  option.prepend(check,icon('M20 10c0 5-8 10-8 10S4 15 4 10a8 8 0 1 1 16 0ZM12 7v6m-3-3h6'));
  const submit = element('button',reply?t('Responder'):t('Publicar'));
  submit.type = 'submit';
  const status = element('p',null,'community-status');
  status.setAttribute('role','status');
  const photo = element('div',null,'community-compose-avatar');
  const refreshAvatar = ()=>photo.replaceChildren(avatar(user?.name,user?.avatar_url));
  refreshAvatar();
  const body = element('div',null,'community-compose-body');
  const actions = element('div',null,'community-compose-actions');
  if(attach)actions.append(option);
  actions.append(submit);
  body.append(field,actions,status);
  form.append(photo,body);
  form.onsubmit = async event=>{
   event.preventDefault();
   const body = field.value.trim();
   if(!body)return;
   submit.disabled = true;
   status.textContent = '';
   try {
    const message = {body};
    if(attach&&check.checked){
     if(!view){
      status.textContent = t('Aguarde o mapa carregar para anexar a vista.');
      return;
     }
     message.view = {
      ra:view.ra,dec:view.dec,fov:view.fov,canal:Number(byId('image-channel').value),
      data:byId('observation-date').value
     };
    }
    await send(message);
    field.value = '';
   } catch(error){
    if(error.message==='401'){
     status.textContent = t('Entre na sua conta para enviar. Seu texto continua aqui.');
     document.dispatchEvent(new Event('eyelid-community-login'));
    } else {
     status.textContent = error.message==='403'
      ? t('Use uma conta pessoal para participar.')
      : t('Não foi possível enviar. Seu texto foi preservado.');
    }
   } finally {submit.disabled = false}
  };
  return form;
 }

 function votes(item){
  const group = element('span',null,'community-votes');
  const score = element('output',String(item.score ?? 0));
  score.setAttribute('aria-live','polite');
  const status = element('span',null,'community-status');
  status.setAttribute('role','status');
  let current = item.vote ?? 0;
  const buttons = [1,-1].map(value=>{
   const button = element('button');
   button.type = 'button';
   button.setAttribute('aria-label',value===1?t('Votar a favor'):t('Votar contra'));
   button.setAttribute('aria-pressed',String(current===value));
   button.append(icon(value===1?'M12 19V5m-6 6 6-6 6 6':'M12 5v14m-6-6 6 6 6-6'));
   button.onclick = async ()=>{
    buttons.forEach(control=>control.disabled=true);
    status.textContent = '';
    try{
     const result = await request(endpoint+'/'+item.id+'/vote',{vote:current===value?0:value});
     current = result.vote;
     score.textContent = result.score;
     buttons.forEach((control,index)=>control.setAttribute('aria-pressed',String(current===[1,-1][index])));
    }catch(error){
     if(error.message==='401')document.dispatchEvent(new Event('eyelid-community-login'));
     else status.textContent = error.message==='403'?t('Use uma conta pessoal para votar.'):t('Não foi possível registrar o voto.');
    }finally{
     buttons.forEach(control=>control.disabled=false);
    }
   };
   return button;
  });
  group.append(buttons[0],score,buttons[1],status);
  return group;
 }

 function entry(item,open){
  const card = element('article',null,'community-post');
  const text = element('p',item.body,'community-message');
  const time = element('time',new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.created_at)));
  time.dateTime = item.created_at;
  const byline = element('div',null,'community-byline');
  const name = element('a',item.author,'community-author');
  name.href = '/?'+new URLSearchParams({perfil:item.author_id});
  byline.append(name,time);
  const content = element('div',null,'community-post-content');
  card.append(avatar(item.author,item.avatar_url),content);
  content.append(byline,text);
  if(item.view){
   const link = element('a',t('Abrir vista no mapa'));
   link.href = '/?'+new URLSearchParams(item.view);
   link.target = '_blank';
   link.rel = 'noopener';
   link.className = 'community-view-link';
   link.setAttribute('aria-label',t('Abrir vista no mapa'));
   link.textContent = '';
   const viewName = element('span',t('Vista compartilhada'));
   viewName.append(element('small',t('SPHEREx · canal ')+item.view.canal+(item.view.data?' · '+item.view.data:'')));
   const action = element('span',t('Abrir vista'),'community-view-action');
   action.prepend(icon('M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Zm4-14-2 6-6 2 2-6 6-2Z'));
   link.append(viewName,action);
   content.append(link);
  }
  const actions = element('div',null,'community-post-actions');
  if(open){
   const count = element('span',item.replies===1?t('1 resposta'):item.replies+t(' respostas'),'community-reply-count');
   count.prepend(icon('M20 11a8 8 0 0 1-12 7l-4 1 1-4a8 8 0 1 1 15-4Z'));
   const button = element('button',t('Ver discussão'));
   button.type = 'button';
   button.onclick = open;
   actions.append(count,button);
  }
  actions.append(votes(item));
  content.append(actions);
  return card;
 }

 function makeFeed(host,fromMap){
  const listing = element('div');
  const thread = fromMap ? byId('community-map-thread') : element('div');
  if(!fromMap)thread.hidden = true;
  const feed = element('div');
  const more = element('button',t('Ver mais'));
  more.type = 'button';
  more.hidden = true;
  let before, trending = false, feedVersion = 0, threadVersion = 0;

  async function refresh(append=false){
   const version = ++feedVersion;
   more.disabled = true;
   try {
    const query = new URLSearchParams();
    if(trending)query.set('sort','trending');
    if(append&&before)query.set('before',before);
    const result = await request(endpoint+'?'+query);
    if(version!==feedVersion)return;
    const cards = result.posts.map(item=>entry(item,()=>openThread(item.id)));
    if(!append)listing.replaceChildren();
    if(!cards.length&&!append)listing.append(element('p',t('Ainda não há publicações.')));
    listing.append(...cards);
    before = result.next;
    more.hidden = !before;
    if(!fromMap){
     byId('community-contributors').replaceChildren(...result.contributors.map(item=>{
      const row = element('li');
      const name = element('a',item.name,'community-author');
      name.href = '/?'+new URLSearchParams({perfil:item.id});
      row.append(name,element('span',item.contributions+(item.contributions===1?t(' contribuição'):t(' contribuições'))));
      return row;
     }));
     byId('community-contributors-empty').hidden = Boolean(result.contributors.length);
    }
   } catch {
    if(version!==feedVersion)return;
    const status = element('p',t('Não foi possível carregar as publicações.'),'community-load-status');
    status.setAttribute('role','status');
    if(!append)listing.replaceChildren(status);
    else listing.append(status);
    more.hidden = true;
   } finally {
    if(version===feedVersion)more.disabled = false;
   }
  }

  async function openThread(id){
   const version = ++threadVersion;
   if(fromMap)document.querySelector('[data-sky-panel=discussion]').click();
   else {feed.hidden = true;thread.hidden = false}
   const back = element('button',t('Voltar à comunidade'));
   back.type = 'button';
   back.onclick = ()=>{
    threadVersion++;
    if(fromMap)document.querySelector('[data-sky-panel=community]').click();
    else {thread.hidden = true;feed.hidden = false}
    refresh();
   };
   thread.replaceChildren(back,element('p',t('Carregando discussão…')));
   try {
    const data = await request(endpoint+'/'+id);
    if(version!==threadVersion)return;
    thread.replaceChildren(back,entry(data.post),element('h3',t('Respostas')));
    for(const reply of data.replies)thread.append(entry(reply));
    if(!data.replies.length)thread.append(element('p',t('Ainda não há respostas.')));
    thread.append(showDraft(async body=>{
     await request(endpoint+'/'+id,body);
     if(version===threadVersion)await openThread(id);
     refresh();
    },{reply:true}));
   } catch {
    if(version===threadVersion)thread.replaceChildren(back,element('p',t('Não foi possível carregar a discussão.')));
   }
  }

  const compose = showDraft(async body=>{
   const result = await request(endpoint,body);
   await refresh();
   await openThread(result.id);
  },{attach:true,fromMap});
  more.onclick = ()=>refresh(true);
  feed.append(compose,listing,more);
  host.append(feed);
  if(!fromMap)host.append(thread);
  return {
   refresh,
   openThread,
   updateAccount(){
    compose.querySelector('.community-compose-avatar').replaceChildren(avatar(user?.name,user?.avatar_url));
    const draftAvatar = thread.querySelector('.community-compose-avatar');
    if(draftAvatar)draftAvatar.replaceChildren(avatar(user?.name,user?.avatar_url));
    refresh();
   },
   tab(section){
    trending = section==='trending';
    threadVersion++;
    thread.hidden = true;
    feed.hidden = false;
    compose.hidden = trending;
    refresh();
   }
  };
 }

 const homeFeed = makeFeed(home,false);
 const skyFeed = makeFeed(mapFeed,true);
 document.addEventListener('eyelid-open-thread',event=>homeFeed.openThread(event.detail));
 document.addEventListener('eyelid-community-tab',event=>homeFeed.tab(event.detail));
 document.querySelector('#eyelid-navigation [data-page=home]').addEventListener('click',()=>homeFeed.refresh());
 for(const button of [byId('restore-object'),document.querySelector('[data-sky-panel=community]')]){
  button.addEventListener('click',()=>skyFeed.refresh());
 }
 document.addEventListener('eyelid-account-changed',event=>{
  user = event.detail;
  homeFeed.updateAccount();
  skyFeed.updateAccount();
 });
 homeFeed.refresh();
}
