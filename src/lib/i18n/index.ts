import { translations, type Language, type TranslationKey } from './translations';

// Get initial language from localStorage or browser
function getInitialLanguage(): Language {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('bgx-language') as Language | null;
    if (stored && ['zh', 'en'].includes(stored)) {
      return stored;
    }
    // Detect browser language
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

  t(key: TranslationKey): string {
    return translations[this.currentLang][key] || key;
  },

  getLanguage(): Language {
    return this.currentLang;
  },
};

// Hook for React components
export function useTranslation() {
  return {
    t: (key: TranslationKey) => i18n.t(key),
    language: i18n.getLanguage(),
    setLanguage: (lang: Language) => {
      i18n.setLanguage(lang);
      // Force re-render by dispatching custom event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('languagechange', { detail: lang }));
      }
    },
  };
}

export type { Language, TranslationKey };
export { translations };
