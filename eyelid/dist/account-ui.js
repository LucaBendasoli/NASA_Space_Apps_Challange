{
 const dialog = byId('eyelid-auth-dialog');
 const frame = dialog.querySelector('iframe');
 const error = byId('account-error');
 const sidebarLogout = byId('sidebar-logout');
 const profileButton = document.querySelector('.eyelid-account');
 let activeUser;
 let sessionVersion = 0;

 function showAccount(user){
  activeUser = user;
  profileButton.querySelector('strong').textContent = user?.name ?? 'Visitante';
  profileButton.setAttribute('aria-label','Meu perfil');
  document.dispatchEvent(new CustomEvent('eyelid-account-changed',{detail:user}));
 }

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

 function openAuth(mode){
  frame.src = '/login.html?modo='+mode;
  dialog.showModal();
 }
 document.addEventListener('eyelid-community-login',()=>openAuth('login'));
 byId('close-eyelid-auth').onclick = () => dialog.close();
 dialog.addEventListener('close', () => {
  frame.removeAttribute('src');
 });
 window.addEventListener('message',event => {
  if(event.origin!==location.origin || event.source!==frame.contentWindow || event.data?.type!=='eyelid-auth-close')return;
  if (dialog.open) dialog.close();
  account();
 });
 const logoutButtons = [byId('account-logout'), sidebarLogout];
 for (const button of logoutButtons){
  button.onclick = async () => {
   for (const control of logoutButtons) control.disabled = true;
   const signedOut = await account('logout');
   for (const control of logoutButtons) control.disabled = false;
   if (signedOut) location.replace('/login.html');
   else if (button === sidebarLogout) profileButton.click();
  };
 }
 document.addEventListener('eyelid-profile-saved',event=>{
  if(event.detail?.id===activeUser?.id)showAccount(event.detail);
 });
 const url = new URL(location.href);
 if(url.searchParams.get('acesso')==='jurados'){
  logoutButtons.forEach(button=>button.disabled=true);
  account('judge').then(ok=>{
   logoutButtons.forEach(button=>button.disabled=false);
   if(!ok){
    document.querySelector('#eyelid-navigation [data-page=profile]').click();
    return;
   }
   url.searchParams.delete('acesso');
   history.replaceState(history.state,'',url);
  });
 }else account();
}
