import { useState, useEffect, useCallback } from 'react';
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
  listeners: new Set<() => void>(),

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  },

  notify() {
    this.listeners.forEach((listener) => listener());
  },

  setLanguage(lang: Language) {
    this.currentLang = lang;
    if (typeof window !== 'undefined') {
      localStorage.setItem('bgx-language', lang);
    }
    this.notify();
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
  const [, forceUpdate] = useState({});

  useEffect(() => {
    return i18n.subscribe(() => {
      forceUpdate({});
    });
  }, []);

  const t = useCallback((key: TranslationKey | string) => i18n.t(key), []);

  const setLanguage = useCallback((lang: Language) => {
    i18n.setLanguage(lang);
  }, []);

  return {
    t,
    language: i18n.getLanguage(),
    setLanguage,
  };
}

export type { TranslationKey };
export { translations };