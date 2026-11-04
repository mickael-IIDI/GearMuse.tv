import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrowseView } from "@/components/browse/browse-view";
import { label } from "@/lib/i18n";
import { getI18n } from "@/server/locale";
import { categoryTree, getCategory } from "@/server/queries/catalog";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCategory(`techno-${slug}`);
  if (!c) return {};
  return {
    title: `Propulsion ${c.labels.fr.toLowerCase()} — vidéos`,
    description: `Vidéos sélectionnées sur la propulsion ${c.labels.fr.toLowerCase()} : voitures, avions, bateaux, trains et fusées.`,
    alternates: { canonical: `/technologies/${slug}` },
    robots: c.videoCount < 3 ? { index: false, follow: true } : undefined,
  };
}

export default async function TechnologyPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { t, locale } = await getI18n();
  const c = await getCategory(`techno-${slug}`);
  if (!c || c.kind !== "technology") notFound();
  const tree = await categoryTree();
  return (
    <BrowseView
      searchParams={await searchParams}
      fixed={{ techno: slug }}
      title={label(c.labels, locale)}
      crumbs={[{ href: "/technologies", label: t.nav.technologies }]}
      chips={tree.technologies.map((x) => ({ href: `/technologies/${x.slug.replace("techno-", "")}`, label: label(x.labels, locale), count: x.videoCount, active: x.slug === c.slug }))}
      defaultSort="qualite"
    />
  );
}
