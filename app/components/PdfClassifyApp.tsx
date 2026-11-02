"use client";

import { useAuth, usePermissions } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import LanguageSwitcher from "./LanguageSwitcher";
import LoginForm from "./LoginForm";
import PdfClassifyPanel from "./PdfClassifyPanel";

export default function PdfClassifyApp() {
  const { t } = useLanguage();
  const { user, loading, signOut } = useAuth();
  const { canPerformAction } = usePermissions();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-100 text-sm text-stone-500">
        {t("common.loading")}
      </div>
    );
  }

  if (!user) {
    return (
      <LoginForm
        title={t("pdf.siteTitle")}
        subtitle={t("pdf.siteLoginHint")}
      />
    );
  }

  if (!canPerformAction("pdf.classify")) {
    return (
      <div className="flex min-h-screen flex-col bg-stone-100">
        <PdfClassifyHeader
          email={user.email}
          onSignOut={() => signOut()}
        />
        <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4 py-10">
          <p className="rounded-xl border border-stone-200 bg-white px-6 py-8 text-center text-sm text-stone-600 shadow-sm">
            {t("auth.noMenuAccess")}
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100">
      <PdfClassifyHeader email={user.email} onSignOut={() => signOut()} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <PdfClassifyPanel />
      </main>
    </div>
  );
}

function PdfClassifyHeader({
  email,
  onSignOut,
}: {
  email?: string | null;
  onSignOut: () => void;
}) {
  const { t } = useLanguage();

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-start justify-between gap-4 px-4 py-6 sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
            {t("pdf.brand")}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900">
            {t("pdf.siteTitle")}
          </h1>
          <p className="mt-1 text-sm text-stone-500">{t("pdf.siteSubtitle")}</p>
        </div>
        <div className="flex items-start gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-xs text-stone-500">{email}</p>
            <button
              type="button"
              onClick={onSignOut}
              className="mt-1 text-sm font-medium text-stone-600 hover:text-stone-900"
            >
              {t("auth.signOut")}
            </button>
          </div>
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
