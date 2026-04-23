import { useState, useEffect, useCallback } from 'react';
import { translations as zh } from './zh';
import { translations as en, type TranslationKey } from './en';

export type Language = 'zh' | 'en';

const translations = { zh, en };

// 服務器端和客戶端首次渲染使用一致的默認語言
const DEFAULT_LANGUAGE: Language = 'en';

// 各語言對應的頁面標題
const titles: Record<Language, string> = {
  zh: 'BGX - 背景移除工具',
  en: 'BGX - Background Remover',
};

function getStoredLanguage(): Language | null {
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
  return null;
}

export const i18n: {
  currentLang: Language;
  listeners: Set<() => void>;
  subscribe: (listener: () => void) => () => void;
  notify: () => void;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey | string) => string;
  getLanguage: () => Language;
} = {
  currentLang: DEFAULT_LANGUAGE,
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
      document.title = titles[lang];
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
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // 客戶端 hydration 完成後，應用存儲的語言設置
    if (!isHydrated) {
      const storedLang = getStoredLanguage();
      if (storedLang && storedLang !== i18n.currentLang) {
        i18n.setLanguage(storedLang);
      }
      setIsHydrated(true);
    }
  }, [isHydrated]);

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
    isHydrated,
  };
}

export type { TranslationKey };
export { translations };
