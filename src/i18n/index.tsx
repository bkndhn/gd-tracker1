import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LANGUAGES, LOCALES, Lang, TranslationKey, translations } from './translations';

const STORAGE_KEY = 'gd_lang';

interface I18nValue {
  lang: Lang;
  locale: string;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  formatNumber: (n: number) => string;
  formatDate: (d: Date | string, opts?: Intl.DateTimeFormatOptions) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function readLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (stored && translations[stored]) return stored;
    const nav = navigator.language?.slice(0, 2);
    if (nav === 'ta' || nav === 'hi') return nav;
  } catch { /* ignore */ }
  return 'en';
}

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(readLang);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      const dict = translations[lang] || translations.en;
      let out = (dict as any)[key] ?? (translations.en as any)[key] ?? String(key);
      if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
          out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        });
      }
      return out;
    },
    [lang],
  );

  const locale = LOCALES[lang];

  const value = useMemo<I18nValue>(() => ({
    lang,
    locale,
    setLang,
    t,
    formatNumber: (n: number) => new Intl.NumberFormat(locale).format(n),
    formatDate: (d: Date | string, opts?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, opts || { dateStyle: 'medium' }).format(
        typeof d === 'string' ? new Date(d) : d,
      ),
  }), [lang, locale, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useTranslation = (): I18nValue => {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Safe fallback so components still render outside the provider (tests, storybook)
    const t = ((key: TranslationKey) => (translations.en as any)[key] ?? String(key)) as I18nValue['t'];
    return {
      lang: 'en',
      locale: 'en-IN',
      setLang: () => undefined,
      t,
      formatNumber: (n: number) => String(n),
      formatDate: (d) => new Date(d as any).toLocaleDateString(),
    };
  }
  return ctx;
};

export { LANGUAGES };
export type { Lang };
