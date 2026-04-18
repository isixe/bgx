import { translations as zh } from './zh';
import { translations as en, type TranslationKey } from './en';

export type Language = 'zh' | 'en';

const translations = { zh, en };

function getInitialLanguage(): Language {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('bgx-language') as Language | null;
    if (stored && ['zh', 'en'].includes(stored)) {
      return stored;
    }
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('zh')) {
      return 'zh';
    }
  }
  return 'en';
}

export const i18n = {
  currentLang: getInitialLanguage(),

  setLanguage(lang: Language) {
    this.currentLang = lang;
    if (typeof window !== 'undefined') {
      localStorage.setItem('bgx-language', lang);
    }
  },

  t(key: TranslationKey | string): string {
    const keys = key.split('.');
    let value: unknown = translations[this.currentLang];
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return key;
      }
    }
    return typeof value === 'string' ? value : key;
  },

  getLanguage(): Language {
    return this.currentLang;
  },
};

export function useTranslation() {
  return {
    t: (key: TranslationKey | string) => i18n.t(key),
    language: i18n.getLanguage(),
    setLanguage: (lang: Language) => {
      i18n.setLanguage(lang);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('languagechange', { detail: lang }));
      }
    },
  };
}

export type { TranslationKey };
export { translations };