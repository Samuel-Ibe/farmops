"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n, LANGUAGE_OPTIONS, type Locale } from "@/lib/i18n";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);

  const currentLang = LANGUAGE_OPTIONS.find((l) => l.value === locale);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(!open)}
        title={t("settings.language")}
      >
        <Globe className="h-5 w-5" />
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-md border bg-card p-1 shadow-lg">
            <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              {t("settings.language")}
            </p>
            {LANGUAGE_OPTIONS.map((lang) => (
              <button
                key={lang.value}
                onClick={() => {
                  setLocale(lang.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors ${
                  locale === lang.value
                    ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                    : "hover:bg-muted"
                }`}
              >
                <span className="text-base">{lang.flag}</span>
                <span>{lang.label}</span>
                {locale === lang.value && (
                  <span className="ml-auto text-green-600 dark:text-green-400">✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
