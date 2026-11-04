import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrowseView } from "@/components/browse/browse-view";
import { label } from "@/lib/i18n";
import { getI18n } from "@/server/locale";
import { getCategory, subcategoriesOf } from "@/server/queries/catalog";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCategory(slug);
  if (!c || c.kind !== "universe") return {};
  return {
    title: `${c.labels.fr} : les meilleures vidéos`,
    description: c.descriptions?.fr ?? undefined,
    alternates: { canonical: `/univers/${slug}` },
  };
}

export default async function UniversePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { t, locale } = await getI18n();
  const c = await getCategory(slug);
  if (!c || c.kind !== "universe") notFound();
  const subs = await subcategoriesOf(c.id);
  return (
    <BrowseView
      searchParams={await searchParams}
      fixed={{ univers: slug }}
      title={label(c.labels, locale)}
      subtitle={c.descriptions ? label(c.descriptions, locale) : undefined}
      crumbs={[{ href: "/categories", label: t.nav.categories }]}
      chips={subs.filter((s) => s.videoCount > 0).map((s) => ({ href: `/univers/${slug}/${s.slug}`, label: label(s.labels, locale), count: s.videoCount }))}
      defaultSort="qualite"
    />
  );
}
