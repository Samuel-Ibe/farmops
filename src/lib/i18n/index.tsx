import { createContext, useContext, useCallback, useState, useEffect } from "react";
import en from "@/lib/i18n/locales/en.json";
import tw from "@/lib/i18n/locales/tw.json";
import ga from "@/lib/i18n/locales/ga.json";
import ewe from "@/lib/i18n/locales/ewe.json";

export type Locale = "en" | "tw" | "ga" | "ewe";

const locales: Record<Locale, Record<string, any>> = { en, tw, ga, ewe };

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

function getNestedValue(obj: Record<string, any>, path: string): string {
  const keys = path.split(".");
  let current: any = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return path;
    current = current[key];
  }
  return typeof current === "string" ? current : path;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const saved = localStorage.getItem("farmops-locale") as Locale;
    if (saved && locales[saved]) {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("farmops-locale", newLocale);
    document.documentElement.lang = newLocale;
  }, []);

  const t = useCallback(
    (key: string): string => {
      return getNestedValue(locales[locale], key);
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    // Fallback if used outside provider
    return {
      locale: "en" as Locale,
      setLocale: () => {},
      t: (key: string) => getNestedValue(en, key),
    };
  }
  return context;
}

export const LANGUAGE_OPTIONS = [
  { value: "en" as Locale, label: "English", flag: "🇬🇧" },
  { value: "tw" as Locale, label: "Twi (Akan)", flag: "🇬🇭" },
  { value: "ga" as Locale, label: "Ga", flag: "🇬🇭" },
  { value: "ewe" as Locale, label: "Ewe", flag: "🇬🇭" },
];
