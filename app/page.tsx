import ContainerOrderApp from "./components/ContainerOrderApp";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";

export default function Home() {
  return (
    <LanguageProvider>
      <ContainerOrderApp />
    </LanguageProvider>
  );
}
