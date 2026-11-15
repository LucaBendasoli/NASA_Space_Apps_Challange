import { dictionaries, getLanguage } from './index.js';

// Presentation-only translation. Source objects, IDs, measurements and state stay intact.
const originals = new WeakMap();
const source = dictionaries['pt-BR'];
const exact = new Map(Object.entries(source).filter(([, value]) => !value.includes('{')).map(([key, value]) => [value.trim(), key]));
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const protectedParameters = {
  'science.metadata': ['p0','p1','p2','p3','p6','p7','p10','p11'],
  'science.comparisonMetadata': ['p0','p1'],
  'science.comparisonMetadataBare': ['p0','p1'],
  'science.optionLabel': ['p1','p3'],
  'science.dateOption': ['p0','p2'],
  'science.observationDescription': ['p1','p2'],
  'science.invalidField': ['p0'],
  'science.apiHttp': ['p0'],
};
const templates = Object.entries(source)
  .filter(([key, value]) => key.startsWith('science.') && value.includes('{'))
  .map(([key, value]) => {
    const names = [];
    const pattern = value.trim().split(/(\{\w+\})/).map(part => {
      if (!/^\{\w+\}$/.test(part)) return escape(part);
      const name = part.slice(1,-1); names.push(name);
      return key === 'science.seriesRole' && name === 'p1' ? '(principal|comparação|referência)' : '(.*?)';
    }).join('');
    const priority=key==='science.optionLabel'?1000:0;
    return { key, names, regex: new RegExp('^'+pattern+'$','s'), specificity: priority+value.replace(/\{\w+\}/g,'').length };
  }).sort((a,b) => b.specificity-a.specificity);

export function localizeText(value, locale = getLanguage(), depth = 0) {
  if (typeof value !== 'string' || locale === 'pt-BR' || depth > 10) return value;
  const text = value.trim();
  if (!text) return value;
  const leading=value.match(/^\s*/)[0], trailing=value.match(/\s*$/)[0];
  const key = exact.get(text);
  if (key) return leading+dictionaries[locale][key].trim()+trailing;
  for (const template of templates) {
    const match = text.match(template.regex);
    if (!match) continue;
    const parameters = Object.fromEntries(template.names.map((name,index) => [name,
      protectedParameters[template.key]?.includes(name) ? match[index+1] : localizeText(match[index+1],locale,depth+1)]));
    return leading+dictionaries[locale][template.key].trim().replace(/\{(\w+)\}/g,(_,name)=>parameters[name])+trailing;
  }
  const pieces=text.split(/( · |(?<=\.)\s+)/);
  if (pieces.length>1) return leading+pieces.map(piece=>piece.trim()?localizeText(piece,locale,depth+1):piece).join('')+trailing;
  return value;
}

function update(node, attribute) {
  const current=attribute?node.getAttribute(attribute):node.data;
  if(current==null)return;
  let records=originals.get(node);
  if(!records){records=new Map();originals.set(node,records);}
  const previous=records.get(attribute);
  const original=previous?.result===current?previous.source:current;
  const result=localizeText(original);
  if(result!==current){if(attribute)node.setAttribute(attribute,result);else node.data=result;}
  records.set(attribute,{source:original,result});
}

export function localizeScienceTree(root) {
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  let node;
  while(node=walker.nextNode())if(!node.parentElement.closest('[translate="no"]'))update(node);
  for(const element of [root,...root.querySelectorAll('*')]){
    if(element.closest('[translate="no"]'))continue;
    for(const attr of ['aria-label','title','placeholder','data-measurement'])if(element.hasAttribute(attr))update(element,attr);
  }
}
