const languageKey = 'eyelid:language';
const language = localStorage.getItem(languageKey) === 'pt-BR' ? 'pt-BR' : 'en';
const locale = language === 'en' ? 'en-US' : 'pt-BR';
document.documentElement.lang = language;

function t(message, ...values){
 if(typeof message==='string')return language==='en' ? (eyelidTranslations[message] ?? message) : message;
 const key = message.reduce((result, part, index)=>result+(index ? '{'+(index-1)+'}' : '')+part,'');
 return (language==='en' ? (eyelidTranslations[key] ?? key) : key).replace(/\{(\d+)\}/g,(_, index)=>values[index]);
}

function localizeMarkup(){
 if(language==='en')return;
 const walker = document.createTreeWalker(document.documentElement,NodeFilter.SHOW_TEXT);
 for(let node=walker.nextNode();node;node=walker.nextNode()){
  const source = node.parentElement?.dataset.eyelidCopy;
  if(source && eyelidTranslations[source]===node.data.trim())node.data = node.data.replace(node.data.trim(),source);
 }
 for(const element of document.querySelectorAll('[data-eyelid-attrs]')){
  for(const [name,value] of Object.entries(JSON.parse(element.dataset.eyelidAttrs)))element.setAttribute(name,value);
 }
}

function chooseLanguage(value){
 localStorage.setItem(languageKey,value==='pt-BR'?'pt-BR':'en');
}
