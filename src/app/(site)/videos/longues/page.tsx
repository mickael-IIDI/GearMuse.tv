import type { Metadata } from "next";
import { BrowseView } from "@/components/browse/browse-view";
import { getI18n } from "@/server/locale";

export const metadata: Metadata = {
  title: "Vidéos longues",
  description: "Documentaires, conférences et explications de plus d'une heure sur l'automobile, l'aviation, la moto et le nautisme.",
  alternates: { canonical: "/videos/longues" },
};

export default async function LongVideosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getI18n();
  return (
    <BrowseView
      searchParams={await searchParams}
      fixed={{ duree: "tres-long" }}
      title={t.nav.long}
      subtitle={locale === "en" ? "Every video over an hour. Time to go deep." : "Toutes les vidéos de plus d'une heure. Le temps d'aller au fond des choses."}
      defaultSort="qualite"
    />
  );
}
