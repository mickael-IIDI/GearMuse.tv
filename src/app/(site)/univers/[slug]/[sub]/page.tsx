import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrowseView } from "@/components/browse/browse-view";
import { label } from "@/lib/i18n";
import { getI18n } from "@/server/locale";
import { getSubcategory, subcategoriesOf } from "@/server/queries/catalog";

type Props = { params: Promise<{ slug: string; sub: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, sub } = await params;
  const r = await getSubcategory(slug, sub);
  if (!r) return {};
  return {
    title: `${r.sub.labels.fr} — ${r.universe.labels.fr}`,
    description: `Les meilleures vidéos sélectionnées : ${r.sub.labels.fr.toLowerCase()} (${r.universe.labels.fr.toLowerCase()}).`,
    alternates: { canonical: `/univers/${slug}/${sub}` },
    // Pas d'indexation des pages trop pauvres (moins de 3 vidéos).
    robots: r.sub.videoCount < 3 ? { index: false, follow: true } : undefined,
  };
}

export default async function SubcategoryPage({ params, searchParams }: Props) {
  const { slug, sub } = await params;
  const { t, locale } = await getI18n();
  const r = await getSubcategory(slug, sub);
  if (!r) notFound();
  const siblings = await subcategoriesOf(r.universe.id);
  return (
    <BrowseView
      searchParams={await searchParams}
      fixed={{ univers: slug, sous: sub }}
      title={label(r.sub.labels, locale)}
      crumbs={[
        { href: "/categories", label: t.nav.categories },
        { href: `/univers/${slug}`, label: label(r.universe.labels, locale) },
      ]}
      chips={siblings.filter((s) => s.videoCount > 0).map((s) => ({ href: `/univers/${slug}/${s.slug}`, label: label(s.labels, locale), count: s.videoCount, active: s.slug === sub }))}
      defaultSort="qualite"
    />
  );
}
