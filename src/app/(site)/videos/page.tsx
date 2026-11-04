import type { Metadata } from "next";
import { BrowseView } from "@/components/browse/browse-view";
import { getI18n } from "@/server/locale";

export const metadata: Metadata = {
  title: "Toutes les vidéos",
  description: "Le catalogue complet des vidéos sélectionnées sur les véhicules motorisés : filtres par date, durée, format, technologie, langue et qualité.",
  alternates: { canonical: "/videos" },
};

export default async function AllVideosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getI18n();
  return (
    <BrowseView
      searchParams={await searchParams}
      title={t.nav.all}
      subtitle={locale === "en" ? "Best first. Combine filters; the URL keeps them so you can share the selection." : "Les meilleures d'abord. Combinez les filtres : l'URL les conserve pour partager la sélection."}
      defaultSort="qualite"
    />
  );
}
