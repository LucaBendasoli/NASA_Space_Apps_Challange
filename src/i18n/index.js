import pt from './pt-BR.js';
import en from './en.js';
import es from './es.js';

export const dictionaries = { 'pt-BR': pt, en, es };
export const languageNames = { 'pt-BR': 'Português (Brasil)', en: 'English', es: 'Español' };
export const preferenceKey = 'orbita-language';
export const isLanguage = value => Object.hasOwn(dictionaries, value);
let language = 'en';
const listeners = new Set();
const padding = new WeakMap();

if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem(preferenceKey);
    if (isLanguage(saved)) language = saved;
  } catch { /* Private/restricted storage still permits changes for this visit. */ }
}

export const getLanguage = () => language;
export function t(key, parameters = {}, locale = language) {
  const message = dictionaries[locale][key] ?? dictionaries.en[key];
  if (message === undefined) throw new Error(`Missing translation: ${key}`);
  return message.replace(/\{(\w+)\}/g, (match, name) => String(parameters[name] ?? match));
}

/** Resolves our domain errors without exposing untranslated provider messages. */
export function errorKey(error) {
  if (error?.i18nKey) return error.i18nKey;
  const key = Object.keys(pt).find(key => key.startsWith('errors.') && pt[key] === error?.message);
  return key ?? (error?.name === 'AbortError' ? 'errors.searchTimeout' : error?.message === 'Failed to fetch' ? 'errors.network' : 'errors.unknown');
}
export function uiError(key) { return Object.assign(new Error(key), { i18nKey: key }); }
export function onLanguageChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

// Updating existing text nodes preserves icons, inputs, focus and live map nodes.
function replaceText(node, value) {
  if (!padding.has(node)) padding.set(node, [node.data.match(/^\s*/)[0], node.data.match(/\s*$/)[0]]);
  const [before, after] = padding.get(node);
  node.data = before + value + after;
}
export function translateDocument(root = document) {
  for (const element of root.querySelectorAll('[data-i18n]')) {
    replaceText(element.firstChild, t(element.dataset.i18n));
  }
  for (const element of root.querySelectorAll('[data-i18n-nodes]')) {
    for (const [index, key] of Object.entries(JSON.parse(element.dataset.i18nNodes))) {
      replaceText(element.childNodes[Number(index)], t(key));
    }
  }
  for (const attribute of ['aria-label', 'title', 'placeholder', 'content']) {
    for (const element of root.querySelectorAll(`[data-i18n-${attribute}]`)) {
      element.setAttribute(attribute, t(element.getAttribute(`data-i18n-${attribute}`)));
    }
  }
  const selector = document.getElementById('language-select');
  if (selector) selector.value = language;
  document.documentElement.lang = language;
}
export function setLanguage(next) {
  if (!isLanguage(next) || next === language) return;
  language = next;
  try { localStorage.setItem(preferenceKey, language); } catch { /* Keep in-memory preference. */ }
  translateDocument();
  for (const callback of listeners) callback(language);
  const announcement = document.getElementById('language-announcement');
  if (announcement) announcement.textContent = t('language.changed', { language: languageNames[language] });
}

if (typeof document !== 'undefined') {
  translateDocument();
  document.getElementById('language-select')?.addEventListener('change', event => setLanguage(event.target.value));
  // The early theme script stays synchronous to avoid a flash of the wrong theme.
  const updateThemeLabel = () => {
    const button = document.getElementById('theme-toggle');
    const text = t(document.documentElement.dataset.theme === 'dark' ? 'theme.light' : 'theme.dark');
    button?.setAttribute('aria-label', text);
    button?.setAttribute('title', text);
  };
  updateThemeLabel();
  onLanguageChange(updateThemeLabel);
  document.addEventListener('themechange', updateThemeLabel);
}
