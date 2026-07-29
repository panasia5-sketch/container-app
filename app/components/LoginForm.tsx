"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import LanguageSwitcher from "./LanguageSwitcher";

export default function LoginForm() {
  const { t } = useLanguage();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const message = await signIn(email, password);
    if (message) {
      setError(message);
    }

    setSubmitting(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <div className="flex justify-end p-4 sm:p-6">
        <LanguageSwitcher />
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {t("app.title")}
            </h1>
            <p className="mt-2 text-sm text-slate-500">{t("auth.subtitle")}</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                {t("auth.email")}
              </span>
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder={t("auth.emailPlaceholder")}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                {t("auth.password")}
              </span>
              <input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder={t("auth.passwordPlaceholder")}
              />
            </label>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? t("auth.signingIn") : t("auth.signIn")}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            {t("auth.adminHint")}
          </p>
        </div>
      </div>
    </div>
  );
}
