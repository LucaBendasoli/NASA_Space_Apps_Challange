{
 const endpoint = '/api/community/posts';
 const home = byId('community-home');
 const mapFeed = byId('community-map');
 let view;
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

 function showDraft(send,{attach=false,reply=false}={}){
  const form = element('form',null,'community-compose');
  const label = element('label',reply?'Sua resposta':'Sua publicação');
  const field = element('textarea');
  field.required = true;
  field.maxLength = 2000;
  field.rows = 2;
  field.placeholder = reply?'Escreva uma resposta':'O que você observou?';
  label.append(field);
  const option = element('label','Anexar a vista atual do céu','community-attach');
  const check = element('input');
  check.type = 'checkbox';
  check.checked = true;
  option.prepend(check);
  const submit = element('button',reply?'Responder':'Publicar');
  submit.type = 'submit';
  const status = element('p',null,'community-status');
  status.setAttribute('role','status');
  if(!attach)form.prepend(element('span','◉','community-avatar'));
  form.append(label);
  if(attach)form.append(option);
  form.append(submit,status);
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
      status.textContent = 'Aguarde o mapa carregar para anexar a vista.';
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
     status.textContent = 'Entre na sua conta para enviar. Seu texto continua aqui.';
     document.dispatchEvent(new Event('eyelid-community-login'));
    } else {
     status.textContent = error.message==='403'
      ? 'Use uma conta pessoal para participar.'
      : 'Não foi possível enviar. Seu texto foi preservado.';
    }
   } finally {submit.disabled = false}
  };
  return form;
 }

 function entry(item,open){
  const card = element('article',null,'community-post');
  const text = element('p',item.body,'community-message');
  const time = element('time',new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.created_at)));
  time.dateTime = item.created_at;
  const byline = element('div',null,'community-byline');
  byline.append(element('strong',item.author),time);
  const avatar = element('span',item.author.split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase(),'community-avatar');
  avatar.setAttribute('aria-hidden','true');
  const content = element('div',null,'community-post-content');
  card.append(avatar,content);
  content.append(byline,text);
  if(item.view){
   const link = element('a','Abrir vista no mapa');
   link.href = '/?'+new URLSearchParams(item.view);
   link.target = '_blank';
   link.rel = 'noopener';
   link.className = 'community-view-link';
   link.setAttribute('aria-label','Abrir vista no mapa');
   link.textContent = '';
   const viewName = element('span','Vista compartilhada');
   viewName.append(element('small','SPHEREx · canal '+item.view.canal+(item.view.data?' · '+item.view.data:'')));
   link.append(viewName,element('span','Abrir vista →'));
   content.append(link);
  }
  if(open){
   const button = element('button',item.replies===1?'1 resposta':item.replies+' respostas');
   button.type = 'button';
   button.onclick = open;
   button.setAttribute('aria-label','Abrir discussão. '+button.textContent);
   content.append(button);
  }
  return card;
 }

 function makeFeed(host,fromMap){
  const listing = element('div');
  const thread = fromMap ? byId('community-map-thread') : element('div');
  if(!fromMap)thread.hidden = true;
  const feed = element('div');
  const more = element('button','Ver mais');
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
    if(!cards.length&&!append)listing.append(element('p','Ainda não há publicações.'));
    listing.append(...cards);
    before = result.next;
    more.hidden = !before;
    if(!fromMap){
     byId('community-contributors').replaceChildren(...result.contributors.map(item=>{
      const row = element('li');
      row.append(element('strong',item.name),element('span',item.contributions+(item.contributions===1?' contribuição':' contribuições')));
      return row;
     }));
     byId('community-contributors-empty').hidden = Boolean(result.contributors.length);
    }
   } catch {
    if(version!==feedVersion)return;
    const retry = element('button','Tentar carregar novamente');
    retry.type = 'button';
    retry.onclick = ()=>refresh();
    listing.replaceChildren(retry);
    more.hidden = true;
   } finally {
    if(version===feedVersion)more.disabled = false;
   }
  }

  async function openThread(id){
   const version = ++threadVersion;
   if(fromMap)document.querySelector('[data-sky-panel=discussion]').click();
   else {feed.hidden = true;thread.hidden = false}
   const back = element('button','Voltar à comunidade');
   back.type = 'button';
   back.onclick = ()=>{
    threadVersion++;
    if(fromMap)document.querySelector('[data-sky-panel=community]').click();
    else {thread.hidden = true;feed.hidden = false}
    refresh();
   };
   thread.replaceChildren(back,element('p','Carregando discussão…'));
   try {
    const data = await request(endpoint+'/'+id);
    if(version!==threadVersion)return;
    thread.replaceChildren(back,entry(data.post),element('h3','Respostas'));
    for(const reply of data.replies)thread.append(entry(reply));
    if(!data.replies.length)thread.append(element('p','Ainda não há respostas.'));
    thread.append(showDraft(async body=>{
     await request(endpoint+'/'+id,body);
     if(version===threadVersion)await openThread(id);
     refresh();
    },{reply:true}));
   } catch {
    if(version===threadVersion)thread.replaceChildren(back,element('p','Não foi possível carregar a discussão.'));
   }
  }

  const compose = showDraft(async body=>{
   const result = await request(endpoint,body);
   await refresh();
   await openThread(result.id);
  },{attach:fromMap});
  more.onclick = ()=>refresh(true);
  feed.append(compose,listing,more);
  host.append(feed);
  if(!fromMap)host.append(thread);
  return {
   refresh,
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
 document.addEventListener('eyelid-community-tab',event=>homeFeed.tab(event.detail));
 document.querySelector('#eyelid-navigation [data-page=home]').addEventListener('click',()=>homeFeed.refresh());
 for(const button of [byId('restore-object'),document.querySelector('[data-sky-panel=community]')]){
  button.addEventListener('click',()=>skyFeed.refresh());
 }
 homeFeed.refresh();
 skyFeed.refresh();
}
