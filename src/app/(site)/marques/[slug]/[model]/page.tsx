import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrowseView } from "@/components/browse/browse-view";
import { getI18n } from "@/server/locale";
import { getModel } from "@/server/queries/catalog";

type Props = { params: Promise<{ slug: string; model: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, model } = await params;
  const r = await getModel(slug, model);
  if (!r) return {};
  return {
    title: `${r.model.name} : vidéos sélectionnées`,
    description: `Les meilleures vidéos sur la ${r.model.name} : essais, mécanique, restauration et histoire.`,
    alternates: { canonical: `/marques/${slug}/${model}` },
    robots: r.model.videoCount < 3 ? { index: false, follow: true } : undefined,
  };
}

export default async function ModelPage({ params, searchParams }: Props) {
  const { slug, model } = await params;
  const { t } = await getI18n();
  const r = await getModel(slug, model);
  if (!r || r.model.videoCount === 0) notFound();
  return (
    <BrowseView
      searchParams={await searchParams}
      fixed={{ marque: slug, modele: model }}
      title={r.model.name}
      crumbs={[
        { href: "/marques", label: t.nav.brands },
        { href: `/marques/${slug}`, label: r.brand.name },
      ]}
      defaultSort="qualite"
    />
  );
}
