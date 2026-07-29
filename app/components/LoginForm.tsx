"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import LanguageSwitcher from "./LanguageSwitcher";

type AuthMode = "signIn" | "signUp";

export default function LoginForm() {
  const { t } = useLanguage();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isSignUp = mode === "signUp";

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
    setSuccess(null);
    setPasswordConfirm("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    if (isSignUp) {
      if (password.length < 6) {
        setError(t("auth.passwordTooShort"));
        setSubmitting(false);
        return;
      }

      if (password !== passwordConfirm) {
        setError(t("auth.passwordMismatch"));
        setSubmitting(false);
        return;
      }

      const result = await signUp(email, password);
      if (result.error) {
        setError(result.error);
      } else if (result.needsEmailConfirmation) {
        setSuccess(t("auth.signUpConfirmEmail"));
        setPassword("");
        setPasswordConfirm("");
      }
    } else {
      const message = await signIn(email, password);
      if (message) {
        setError(message);
      }
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
            <p className="mt-2 text-sm text-slate-500">
              {isSignUp ? t("auth.signUpSubtitle") : t("auth.subtitle")}
            </p>
          </div>

          <div className="mt-6 flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => switchMode("signIn")}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                !isSignUp
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t("auth.signIn")}
            </button>
            <button
              type="button"
              onClick={() => switchMode("signUp")}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                isSignUp
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t("auth.signUp")}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
                autoComplete={isSignUp ? "new-password" : "current-password"}
                minLength={isSignUp ? 6 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder={t("auth.passwordPlaceholder")}
              />
            </label>

            {isSignUp && (
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  {t("auth.passwordConfirm")}
                </span>
                <input
                  required
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder={t("auth.passwordConfirmPlaceholder")}
                />
              </label>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting
                ? isSignUp
                  ? t("auth.signingUp")
                  : t("auth.signingIn")
                : isSignUp
                  ? t("auth.signUp")
                  : t("auth.signIn")}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            {isSignUp ? t("auth.signUpHint") : t("auth.signInHint")}
          </p>
        </div>
      </div>
    </div>
  );
}
