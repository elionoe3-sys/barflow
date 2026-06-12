// src/i18n/index.ts
import fr from './locales/fr.json';
import en from './locales/en.json';
import wo from './locales/wo.json';
import srr from './locales/srr.json';
import dyo from './locales/dyo.json';
import ar from './locales/ar.json';

export type Language = 'fr' | 'en' | 'wo' | 'srr' | 'dyo' | 'ar';

const translations: Record<Language, any> = {
  fr,
  en,
  wo,
  srr,
  dyo,
  ar,
};

// Langue par défaut
let currentLanguage: Language = 'fr';

// Charger la langue sauvegardée
if (typeof localStorage !== 'undefined') {
  const savedLang = localStorage.getItem('app_language') as Language;
  if (savedLang && translations[savedLang]) {
    currentLanguage = savedLang;
  }
}

export function setLanguage(lang: Language) {
  currentLanguage = lang;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('app_language', lang);
  }
  window.dispatchEvent(new Event('languagechange'));
}

export function getCurrentLanguage(): Language {
  return currentLanguage;
}

export function t(key: string, lang?: Language): string {
  const targetLang = lang || currentLanguage;
  const keys = key.split('.');
  let value: any = translations[targetLang];
  
  for (const k of keys) {
    if (value && typeof value === 'object') {
      value = value[k];
    } else {
      value = undefined;
      break;
    }
  }
  
  if (typeof value === 'string') {
    return value;
  }
  
  // Fallback vers le français
  let fallback: any = translations.fr;
  for (const k of keys) {
    if (fallback && typeof fallback === 'object') {
      fallback = fallback[k];
    } else {
      fallback = undefined;
      break;
    }
  }
  
  if (typeof fallback === 'string') {
    return fallback;
  }
  
  console.warn(`Translation missing: ${key} (${targetLang})`);
  return key;
}

// Hook React
import { useEffect, useState } from 'react';

export function useTranslation() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const handler = () => forceUpdate(n => n + 1);
    window.addEventListener('languagechange', handler);
    return () => window.removeEventListener('languagechange', handler);
  }, []);

  return {
    t: (key: string) => t(key),
    setLanguage,
    currentLanguage: getCurrentLanguage(),
  };
}

// Informations sur les langues
export const languages = [
  { code: 'fr' as Language, name: 'Français', flag: '🇫🇷', native: 'Français', direction: 'ltr' },
  { code: 'en' as Language, name: 'English', flag: '🇬🇧', native: 'English', direction: 'ltr' },
  { code: 'wo' as Language, name: 'Wolof', flag: '🇸🇳', native: 'Wolof', direction: 'ltr' },
  { code: 'srr' as Language, name: 'Sérère', flag: '🇸🇳', native: 'Sérère', direction: 'ltr' },
  { code: 'dyo' as Language, name: 'Diola', flag: '🇸🇳', native: 'Diola', direction: 'ltr' },
  { code: 'ar' as Language, name: 'العربية', flag: '🇸🇦', native: 'العربية', direction: 'rtl' },
];