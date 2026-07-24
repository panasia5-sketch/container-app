"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Locale } from "@/lib/i18n/translations";

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-500">{t("lang.label")}</span>
      <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
        {(["ko", "en"] as Locale[]).map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => setLocale(lang)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              locale === lang
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t(`lang.${lang}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
