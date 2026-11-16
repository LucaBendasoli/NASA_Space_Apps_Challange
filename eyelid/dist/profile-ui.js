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
   const body = document.createElement('div');
   const avatar = document.createElement('span');
   const author = document.createElement('strong');
   const byline = document.createElement('div');
   avatar.className = 'community-avatar';
   avatar.textContent = byId('profile-initials').textContent;
   avatar.setAttribute('aria-hidden','true');
   if(profile.profile.avatar_url){
    const image = document.createElement('img');
    image.alt = '';
    image.src = profile.profile.avatar_url+mediaVersion;
    avatar.append(image);
   }
   author.textContent = profile.profile.name;
   byline.className = 'community-byline';
   const date = document.createElement('time');
   const message = document.createElement('p');
   const discussion = document.createElement('button');
   date.dateTime = item.created_at;
   date.textContent = new Date(item.created_at).toLocaleDateString(locale);
   message.textContent = item.body;
   discussion.type = 'button';
   discussion.textContent = t('Ver discussão');
   discussion.onclick = ()=>{
    byId('eyelid-navigation').querySelector('[data-section=community]').click();
    document.dispatchEvent(new CustomEvent('eyelid-open-thread',{detail:item.parent_id??item.id}));
   };
   byline.append(author,date);
   body.append(byline,message,discussion);
   article.append(avatar,body);
   if(item.view){
    const link = document.createElement('a');
    link.href = '/?'+new URLSearchParams(item.view);
    link.textContent = t('Abrir vista');
    body.append(link);
   }
   activity.append(article);
  }
  if(!activity.children.length){
   const empty = document.createElement('p');
   empty.textContent = tab==='posts'?t('Ainda não há publicações.'):t('Ainda não há respostas.');
   activity.append(empty);
  }
 }

 async function loadProfile(){
  const request = ++version;
  const target = new URLSearchParams(location.search).get('perfil') ?? 'self';
  content.hidden = true;
  notice.hidden = false;
  notice.textContent = t('Carregando perfil…');
  try{
   const response = await fetch('/api/community/profile/'+encodeURIComponent(target),{cache:'no-store'});
   if(!response.ok)throw new Error();
   const data = await response.json();
   if(request!==version || page.hidden)return;
   profile = data;
   const {name:displayName,bio,avatar_url,cover_url} = data.profile;
   const name = data.profile.role ? t(displayName) : displayName;
   byId('profile-title').textContent = name;
   byId('profile-post-count').textContent = profile.post_count===1?t('1 publicação'):t`${profile.post_count ?? 0} publicações`;
   byId('account-status').textContent = name;
   byId('profile-initials').textContent = name.split(/\s+/).slice(0,2).map(word=>Array.from(word)[0]).join('').toUpperCase();
   byId('profile-bio').textContent = bio ?? '';
   byId('profile-bio').hidden = !bio;
   setImage(byId('profile-photo'),avatar_url && avatar_url+mediaVersion);
   setImage(byId('profile-cover'),cover_url?cover_url+mediaVersion:'./brand/profile-cover.webp');
   edit.hidden = !data.editable;
   byId('profile-preferences').hidden = !data.own;
   renderActivity();
   content.hidden = false;
   notice.hidden = true;
  }catch{
   if(request===version)notice.textContent = t('Não foi possível abrir este perfil.');
  }
 }

 async function resizePhoto(file,width,height){
  if(file.size>10*1024*1024)throw new Error(t('Selecione uma imagem de até 10 MB.'));
  const image = await createImageBitmap(file).catch(()=>{throw new Error(t('Selecione uma imagem válida.'))});
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
  setImage(byId('preview-profile-cover'),byId('profile-cover').src);
  setImage(byId('preview-profile-photo'),profile.profile.avatar_url && profile.profile.avatar_url+mediaVersion);
  status.textContent = '';
  editor.showModal();
 };
 const preferences = byId('profile-preferences-dialog');
 const languageChoice = byId('platform-language');
 languageChoice.value = language;
 byId('profile-preferences').onclick = ()=>preferences.showModal();
 languageChoice.onchange = ()=>{
  chooseLanguage(languageChoice.value);
  const destination = new URL(location.href);
  destination.searchParams.set('perfil','self');
  location.replace(destination);
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
   if(!response.ok)throw new Error(t('Não foi possível salvar o perfil. Confira os campos e as imagens.'));
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
