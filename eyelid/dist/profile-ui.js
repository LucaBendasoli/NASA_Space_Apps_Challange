{
 const page = byId('eyelid-profile-page');
 const content = byId('profile-content');
 const notice = byId('account-error');
 const editor = byId('edit-profile-dialog');
 const form = byId('edit-profile-form');
 const fields = form.elements;
 const status = byId('edit-profile-status');
 const edit = byId('edit-profile');
 const activity = byId('profile-activity');
 const tabs = [...page.querySelectorAll('[data-profile-tab]')];
 let profile, tab = 'posts', version = 0, mediaVersion = '';

 function setImage(image, url){
  image.hidden = !url;
  if(url)image.src = url;
  else image.removeAttribute('src');
 }

 function renderActivity(){
  for(const button of tabs)button.setAttribute('aria-pressed',String(button.dataset.profileTab===tab));
  activity.replaceChildren();
  for(const item of profile[tab]){
   const article = document.createElement('article');
   const date = document.createElement('time');
   const message = document.createElement('p');
   const discussion = document.createElement('button');
   date.dateTime = item.created_at;
   date.textContent = new Date(item.created_at).toLocaleDateString('pt-BR');
   message.textContent = item.body;
   discussion.type = 'button';
   discussion.textContent = 'Ver discussão';
   discussion.onclick = ()=>{
    byId('eyelid-navigation').querySelector('[data-section=community]').click();
    document.dispatchEvent(new CustomEvent('eyelid-open-thread',{detail:item.parent_id??item.id}));
   };
   article.append(date,message,discussion);
   if(item.view){
    const link = document.createElement('a');
    link.href = '/?'+new URLSearchParams(item.view);
    link.textContent = 'Abrir vista';
    article.append(link);
   }
   activity.append(article);
  }
  if(!activity.children.length){
   const empty = document.createElement('p');
   empty.textContent = tab==='posts'?'Ainda não há publicações.':'Ainda não há respostas.';
   activity.append(empty);
  }
 }

 async function loadProfile(){
  const request = ++version;
  const target = new URLSearchParams(location.search).get('perfil') ?? 'self';
  content.hidden = true;
  notice.hidden = false;
  notice.textContent = 'Carregando perfil…';
  try{
   const response = await fetch('/api/community/profile/'+encodeURIComponent(target),{cache:'no-store'});
   if(!response.ok)throw new Error();
   const data = await response.json();
   if(request!==version || page.hidden)return;
   profile = data;
   const {name,bio,avatar_url,cover_url} = data.profile;
   byId('profile-title').textContent = data.own?'Meu perfil':'Perfil';
   byId('account-status').textContent = name;
   byId('profile-initials').textContent = name.split(/\s+/).slice(0,2).map(word=>Array.from(word)[0]).join('').toUpperCase();
   byId('profile-bio').textContent = bio ?? '';
   byId('profile-bio').hidden = !bio;
   byId('profile-count').textContent = data.count;
   setImage(byId('profile-photo'),avatar_url && avatar_url+mediaVersion);
   setImage(byId('profile-cover'),cover_url?cover_url+mediaVersion:'./brand/profile-cover.webp');
   edit.hidden = !data.editable;
   byId('account-logout').hidden = !data.own;
   renderActivity();
   content.hidden = false;
   notice.hidden = true;
  }catch{
   if(request===version)notice.textContent = 'Não foi possível abrir este perfil.';
  }
 }

 async function resizePhoto(file,width,height){
  if(file.size>10*1024*1024)throw new Error('Selecione uma imagem de até 10 MB.');
  const image = await createImageBitmap(file).catch(()=>{throw new Error('Selecione uma imagem válida.')});
  try{
   const scale = Math.max(width/image.width,height/image.height);
   const canvas = document.createElement('canvas');
   canvas.width = width;
   canvas.height = height;
   canvas.getContext('2d').drawImage(image,(width-image.width*scale)/2,(height-image.height*scale)/2,image.width*scale,image.height*scale);
   return canvas.toDataURL('image/jpeg',.8).split(',')[1];
  }finally{image.close()}
 }

 edit.onclick = ()=>{
  form.reset();
  fields.name.value = profile.profile.name;
  fields.bio.value = profile.profile.bio;
  fields.removePhoto.closest('label').hidden = !profile.profile.avatar_url;
  fields.removeCover.closest('label').hidden = !profile.profile.cover_url;
  status.textContent = '';
  editor.showModal();
 };
 byId('cancel-profile-edit').onclick = ()=>editor.close();
 form.onsubmit = async event=>{
  event.preventDefault();
  const submit = form.querySelector('[type=submit]');
  submit.disabled = true;
  status.textContent = '';
  try{
   const body = {name:fields.name.value,bio:fields.bio.value};
   for(const [field,remove,width,height] of [['photo','removePhoto',128,128],['cover','removeCover',640,200]]){
    if(fields[field].files[0])body[field] = await resizePhoto(fields[field].files[0],width,height);
    else if(fields[remove].checked)body[field] = null;
   }
   const response = await fetch('/api/auth/profile',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
   });
   if(!response.ok)throw new Error('Não foi possível salvar o perfil. Confira os campos e as imagens.');
   const {user} = await response.json();
   mediaVersion = '?v='+Date.now();
   editor.close();
   document.dispatchEvent(new CustomEvent('eyelid-profile-saved',{detail:user}));
  }catch(error){
   status.textContent = error.message;
  }finally{submit.disabled = false}
 };
 for(const button of tabs)button.onclick = ()=>{tab = button.dataset.profileTab;renderActivity()};
 document.addEventListener('eyelid-page',event=>{
  if(event.detail==='profile'){tab='posts';loadProfile()}
 });
 document.addEventListener('eyelid-account-changed',()=>{if(!page.hidden)loadProfile()});
 if(!page.hidden)loadProfile();
}
