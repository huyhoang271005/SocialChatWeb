import { vi } from './vi.js';
import { en } from './en.js';

const translations = {
  vi,
  en
};

export function getLanguage() {
  const savedLang = localStorage.getItem('chat_lang');
  if (savedLang) return savedLang;
  
  // Fallback to browser system language
  if (navigator.language && navigator.language.startsWith('vi')) {
    return 'vi';
  }
  return 'en';
}

export function setLanguage(lang) {
  if (lang !== 'vi' && lang !== 'en') return;
  localStorage.setItem('chat_lang', lang);
  window.location.reload();
}

export function t(key) {
  const lang = getLanguage();
  return translations[lang]?.[key] || translations['en']?.[key] || key;
}

export function formatSystemMessage(type, text) {
  if (!text) return '';
  const msgType = String(type || '').toUpperCase();
  if (msgType === 'REMOVE_MEMBER' || msgType === 'ADD_MEMBER') {
    const match = text.match(/^([^{]+)\s*\{([^}]+)\}/);
    let initiator = '';
    let target = '';
    if (match) {
      initiator = match[1].trim();
      target = match[2].trim();
    } else {
      const parts = text.split(',').map(s => s.trim());
      initiator = parts[0] || '';
      target = parts.slice(1).join(', ');
    }
    const translationKey = msgType === 'REMOVE_MEMBER' ? 'smail_remove_member' : 'smail_add_member';
    return t(translationKey).replace('{initiator}', initiator).replace('{target}', target);
  }
  if (msgType === 'LEAVED') {
    return t('smail_leave').replace('{user}', text.trim());
  }
  return text;
}

