"use client";

import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import ContainerOrderApp from "./ContainerOrderApp";
import LoginForm from "./LoginForm";

export default function AppShell() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">
        {t("common.loading")}
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return <ContainerOrderApp />;
}
