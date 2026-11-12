import { useState, useEffect, useCallback } from 'react';
import { translations as zh } from './zh';
import { translations as en, type TranslationKey } from './en';

export type Language = 'zh' | 'en';

const translations = { zh, en };

const DEFAULT_LANGUAGE: Language = 'en';

// 各語言對應的頁面標題
const titles: Record<Language, string> = {
  zh: 'BGX - 背景移除工具',
  en: 'BGX - Background Remover',
};

declare global {
  interface Window {
    __BGX_LANG__?: Language;
  }
}

function isLanguage(value: unknown): value is Language {
  return value === 'zh' || value === 'en';
}

/**
 * 解析客戶端應使用的語言。
 * 優先級：Layout 內聯預水合腳本寫入的 window.__BGX_LANG__（首幀前已確定）
 * → localStorage → 瀏覽器語言 → null。服務器端返回 null（回退默認語言）。
 */
function resolveClientLanguage(): Language | null {
  if (typeof window === 'undefined') {
    return null;
  }
  if (isLanguage(window.__BGX_LANG__)) {
    return window.__BGX_LANG__;
  }
  const stored = localStorage.getItem('bgx-language');
  if (isLanguage(stored)) {
    return stored;
  }
  if (navigator.language.toLowerCase().startsWith('zh')) {
    return 'zh';
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
  currentLang: resolveClientLanguage() ?? DEFAULT_LANGUAGE,
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
      window.__BGX_LANG__ = lang;
      document.title = titles[lang];
      document.documentElement.lang = lang;
      document.documentElement.setAttribute('data-lang', lang);
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
