function returnToExplorer(){
 if (parent !== window) parent.postMessage({type:'eyelid-auth-close'},location.origin);
 else location.assign('/');
}

for (const [screen, action] of [['eyelid-login','login'],['eyelid-register','register']]){
 const root = document.getElementById(screen);
 const form = root.querySelector('form');
 const judge = document.createElement('button');
 const cancel = root.querySelector('[data-route="sky"]') ?? document.createElement('button');
 if (!cancel.isConnected){
  cancel.className = 'guest';
  cancel.type = 'button';
  cancel.textContent = 'Explorar sem conta';
  cancel.onclick = returnToExplorer;
  form.after(cancel);
 }
 judge.type = 'button';
 judge.className = 'judge-login';
 judge.textContent = 'Login de jurados';
 form.after(judge);
 const status = document.createElement('p');
 status.className = 'status';
 status.setAttribute('role','status');
 judge.after(status);
 const language = root.querySelector('select');
 language.addEventListener('change',()=>{
  judge.textContent = language.value === 'en' ? 'Judges’ login' : 'Login de jurados';
  if (action === 'register') cancel.textContent = language.value === 'en' ? 'Explore as guest' : 'Explorar sem conta';
  status.textContent = '';
 });

 async function submit(endpoint, body){
  if (judge.disabled) return;
  const submitButton = form.querySelector('button[type=submit]');
  judge.disabled = submitButton.disabled = true;
  status.textContent = '';
  const english = language.value === 'en';
  const errors = english ? {
   invalid:'Check the fields and try again.', exists:'This email already has an account.',
   credentials:'Incorrect email or password.', retry:'Please wait and try again.'
  } : {
   invalid:'Confira os campos e tente novamente.', exists:'Já existe uma conta com este e-mail.',
   credentials:'E-mail ou senha incorretos.', retry:'Aguarde e tente novamente.'
  };
  try {
   const response = await fetch('/api/auth/'+endpoint,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
   });
   const result = await response.json();
   if (!response.ok || !result.user) throw Error(result.error);
   returnToExplorer();
  } catch(error){
   status.textContent = errors[error.message] ?? (english ? 'Could not connect. Try again.' : 'Não foi possível conectar. Tente novamente.');
   judge.disabled = submitButton.disabled = false;
  }
 }
 judge.onclick = () => submit('judge',{});
 form.onsubmit = event => {
  event.preventDefault();
  const body = {email:form.querySelector('input[type=email]').value,
   password:form.querySelector('input[autocomplete$=password]').value};
  if (action === 'register') body.name = form.querySelector('#eyelid-display-name').value;
  submit(action,body);
 };
}

document.addEventListener('keydown',event=>{
 if (event.key === 'Escape' && parent !== window) {
  event.preventDefault();
  returnToExplorer();
 }
});
