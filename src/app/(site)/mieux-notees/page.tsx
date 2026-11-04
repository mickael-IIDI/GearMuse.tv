import type { Metadata } from "next";
import Link from "next/link";
import { BrowseView } from "@/components/browse/browse-view";
import { getI18n } from "@/server/locale";

export const metadata: Metadata = {
  title: "Les mieux notées",
  description: "Les vidéos ayant obtenu les meilleures notes qualitatives internes : pertinence, profondeur technique, recommandations indépendantes et valeur durable.",
  alternates: { canonical: "/mieux-notees" },
};

export default async function TopRatedPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getI18n();
  const en = locale === "en";
  return (
    <BrowseView
      searchParams={await searchParams}
      title={t.nav.topRated}
      subtitle={
        <>
          {en ? "Sorted by our internal quality score (0–100). " : "Triées par notre note qualitative interne (0 à 100). "}
          <Link href="/a-propos#notation" className="text-link underline">{en ? "How is it computed?" : "Comment est-elle calculée ?"}</Link>
        </>
      }
      defaultSort="qualite"
    />
  );
}
