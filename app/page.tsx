import AppShell from "./components/AppShell";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";

export default function Home() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </LanguageProvider>
  );
}
