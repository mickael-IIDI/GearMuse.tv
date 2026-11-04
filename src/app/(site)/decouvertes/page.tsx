import type { Metadata } from "next";
import { BrowseView } from "@/components/browse/browse-view";
import { getI18n } from "@/server/locale";

export const metadata: Metadata = {
  title: "Découvertes et pépites méconnues",
  description: "Des vidéos appréciées par des passionnés mais peu vues : la face cachée du catalogue.",
  alternates: { canonical: "/decouvertes" },
};

export default async function DiscoveriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getI18n();
  const en = locale === "en";
  return (
    <BrowseView
      searchParams={await searchParams}
      fixed={{ qualite: "pepites" }}
      title={t.nav.discoveries}
      subtitle={en ? "Recommended by enthusiasts, little watched on YouTube. Requires view counts: videos without known views are not shown here." : "Recommandées par des passionnés, peu vues sur YouTube. Nécessite le nombre de vues : les vidéos sans statistiques connues n'apparaissent pas ici."}
      defaultSort="decouverte"
    />
  );
}
