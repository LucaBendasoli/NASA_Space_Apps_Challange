{
 const dialog = byId('eyelid-auth-dialog');
 const frame = dialog.querySelector('iframe');
 const error = byId('account-error');
 const sidebarLogout = byId('sidebar-logout');
 const profileButton = document.querySelector('.eyelid-account');
 const photoControls = byId('account-photo-controls');
 const photoFile = byId('account-photo-file');
 const photoPreview = byId('account-photo');
 const removePhoto = byId('remove-account-photo');
 const photoStatus = byId('account-photo-status');
 let activeUser;
 let returnToMap = false;
 let sessionVersion = 0;

 function showAccount(user){
  activeUser = user;
  photoControls.hidden = user?.role !== 'member';
  photoPreview.hidden = !user?.avatar_url;
  removePhoto.hidden = !user?.avatar_url;
  if(user?.avatar_url)photoPreview.src = user.avatar_url;
  else photoPreview.removeAttribute('src');
  byId('account-status').textContent = user?.name ?? 'Você está explorando como visitante';
  byId('account-email').hidden = !user?.email;
  byId('account-email').textContent = user?.email ?? '';
  byId('account-guest').hidden = Boolean(user);
  byId('account-logout').hidden = !user;
  sidebarLogout.hidden = !user;
  document.querySelector('.eyelid-account strong').textContent = user?.name ?? 'Visitante';
  profileButton.setAttribute('aria-label',user ? 'Meu perfil' : 'Perfil de visitante');
  document.dispatchEvent(new CustomEvent('eyelid-account-changed',{detail:user}));
 }

 async function savePhoto(file){
  const owner = activeUser?.id;
  photoFile.disabled = removePhoto.disabled = true;
  photoStatus.textContent = '';
  try {
   let photo = null;
   if(file){
    if(file.size > 10 * 1024 * 1024)throw Error('Selecione uma imagem de até 10 MB.');
    const image = await createImageBitmap(file).catch(()=>{throw Error('Selecione uma imagem válida.')});
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const size = Math.min(image.width,image.height);
    canvas.getContext('2d').drawImage(image,(image.width-size)/2,(image.height-size)/2,size,size,0,0,128,128);
    image.close();
    photo = canvas.toDataURL('image/jpeg',.8).split(',')[1];
   }
   if(activeUser?.id !== owner)return;
   const response = await fetch('/api/auth/photo',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({photo})
   });
   if(!response.ok)throw Error('Não foi possível salvar a foto.');
   const {user} = await response.json();
   if(activeUser?.id !== owner)return;
   if(user.avatar_url)user.avatar_url += '?v='+Date.now();
   showAccount(user);
   photoStatus.textContent = file?'Foto atualizada.':'Foto removida.';
  } catch(error){
   photoStatus.textContent = error.message;
  } finally {
   photoFile.value = '';
   photoFile.disabled = removePhoto.disabled = false;
  }
 }
 photoFile.onchange = ()=>{if(photoFile.files[0])savePhoto(photoFile.files[0])};
 removePhoto.onclick = ()=>savePhoto(null);

 async function account(action){
  const version = ++sessionVersion;
  if (action) error.hidden = true;
  try {
   const response = await fetch('/api/auth/'+(action??'session'),action ? {
    method:'POST',headers:{'Content-Type':'application/json'},body:'{}'
   } : {cache:'no-store'});
   if (!response.ok) throw Error(response.status);
   const {user} = await response.json();
   if (version === sessionVersion) showAccount(user);
  } catch {
   if (action && version === sessionVersion){
    error.textContent = 'Não foi possível atualizar a sessão. Tente novamente.';
    error.hidden = false;
    return false;
   }
  }
  return true;
 }

 function openAuth(mode, goBackToMap = true){
  returnToMap = goBackToMap;
  frame.src = '/login.html?modo='+mode;
  dialog.showModal();
 }
 for (const button of document.querySelectorAll('[data-auth-mode]')){
  button.onclick = () => openAuth(button.dataset.authMode);
 }
 document.addEventListener('eyelid-community-login',()=>openAuth('login',false));
 byId('close-eyelid-auth').onclick = () => dialog.close();
 dialog.addEventListener('close', () => {
  frame.removeAttribute('src');
  if(returnToMap) document.querySelector('#eyelid-navigation [data-page=map]').click();
  returnToMap = false;
 });
 window.addEventListener('message',event => {
  if(event.origin!==location.origin || event.source!==frame.contentWindow || event.data?.type!=='eyelid-auth-close')return;
  if (dialog.open) dialog.close();
  account();
 });
 byId('account-judge').onclick = async () => {
  if (await account('judge'))document.querySelector('#eyelid-navigation [data-page=map]').click();
 };
 const logoutButtons = [byId('account-logout'), sidebarLogout];
 for (const button of logoutButtons){
  button.onclick = async () => {
   for (const control of logoutButtons) control.disabled = true;
   const signedOut = await account('logout');
   for (const control of logoutButtons) control.disabled = false;
   if (signedOut) openAuth('login');
   else if (button === sidebarLogout) profileButton.click();
  };
 }
 const url = new URL(location.href);
 if(url.searchParams.get('acesso')==='jurados'){
  account('judge').then(ok=>{
   if(!ok){
    document.querySelector('#eyelid-navigation [data-page=profile]').click();
    return;
   }
   url.searchParams.delete('acesso');
   history.replaceState(history.state,'',url);
  });
 }else account();
}
