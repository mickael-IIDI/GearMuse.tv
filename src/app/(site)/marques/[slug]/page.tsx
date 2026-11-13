import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AffiliateBlock } from "@/components/affiliate/affiliate-block";
import { BrowseView } from "@/components/browse/browse-view";
import { getI18n } from "@/server/locale";
import { getBrand } from "@/server/queries/catalog";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const r = await getBrand(slug);
  if (!r) return {};
  return {
    title: `${r.brand.name} : vidéos sélectionnées`,
    description: `Essais, histoire, mécanique et documentaires sur ${r.brand.name}, sélectionnés pour leur valeur.`,
    alternates: { canonical: `/marques/${slug}` },
    robots: r.brand.videoCount < 3 ? { index: false, follow: true } : undefined,
  };
}

export default async function BrandPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { t } = await getI18n();
  const r = await getBrand(slug);
  if (!r || r.brand.videoCount === 0) notFound();
  return (
    <BrowseView
      searchParams={await searchParams}
      fixed={{ marque: slug }}
      title={r.brand.name}
      crumbs={[{ href: "/marques", label: t.nav.brands }]}
      chips={r.models.map((m) => ({ href: `/marques/${slug}/${m.slug}`, label: m.name, count: m.videoCount }))}
      defaultSort="qualite"
      outro={<AffiliateBlock className="mt-10" subject={{ name: r.brand.name, universes: r.brand.universes }} />}
    />
  );
}
