import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrowseView } from "@/components/browse/browse-view";
import { label } from "@/lib/i18n";
import { getI18n } from "@/server/locale";
import { categoryTree, getCategory } from "@/server/queries/catalog";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCategory(slug);
  if (!c || c.kind !== "theme") return {};
  return {
    title: `${c.labels.fr} — vidéos tous véhicules`,
    description: `Vidéos sélectionnées sur le thème « ${c.labels.fr.toLowerCase()} », de l'automobile à l'aviation et au nautisme.`,
    alternates: { canonical: `/themes/${slug}` },
    robots: c.videoCount < 3 ? { index: false, follow: true } : undefined,
  };
}

export default async function ThemePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { t, locale } = await getI18n();
  const c = await getCategory(slug);
  if (!c || c.kind !== "theme") notFound();
  const tree = await categoryTree();
  return (
    <BrowseView
      searchParams={await searchParams}
      fixed={{ theme: slug }}
      title={label(c.labels, locale)}
      crumbs={[{ href: "/technologies", label: t.nav.technologies }]}
      chips={tree.themes.filter((x) => x.videoCount > 0).map((x) => ({ href: `/themes/${x.slug}`, label: label(x.labels, locale), count: x.videoCount, active: x.slug === slug }))}
      defaultSort="qualite"
    />
  );
}
