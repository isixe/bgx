import { useState, useEffect } from 'react';
import { i18n, type Language } from './index';

function initClientLanguage(): Language {
  if (typeof window === 'undefined') {
    return 'en';
  }
  const stored = localStorage.getItem('bgx-language') as Language | null;
  if (stored && ['zh', 'en'].includes(stored)) {
    return stored;
  }
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('zh')) {
    return 'zh';
  }
  return 'en';
}

export function useLanguage() {
  const [language, setLanguageState] = useState<Language>('en');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const clientLang = initClientLanguage();
    i18n.setLanguage(clientLang);
    setLanguageState(clientLang);
    setIsHydrated(true);

    const handleLanguageChange = (e: CustomEvent<Language>) => {
      setLanguageState(e.detail);
    };

    window.addEventListener('languagechange', handleLanguageChange as EventListener);
    return () => {
      window.removeEventListener('languagechange', handleLanguageChange as EventListener);
    };
  }, []);

  return { language, isHydrated };
}
