import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { getI18n } from "@/server/locale";
import { brandList } from "@/server/queries/catalog";

export const metadata: Metadata = {
  title: "Marques et constructeurs",
  description: "Constructeurs automobiles, motos, avionneurs, chantiers navals : les marques présentes dans le catalogue de vidéos.",
  alternates: { canonical: "/marques" },
};

export default async function BrandsPage() {
  const { t, locale } = await getI18n();
  const brands = await brandList(1);
  return (
    <>
      <PageHeader title={t.nav.brands} subtitle={locale === "en" ? "Only brands with at least one published video are listed." : "Seules les marques ayant au moins une vidéo publiée sont listées."} crumbs={[{ href: "/categories", label: t.nav.categories }]} />
      {brands.length ? (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          {brands.map((b) => (
            <li key={b.slug}>
              <Link href={`/marques/${b.slug}`} className="flex items-baseline justify-between rounded-xl border border-line bg-elev px-4 py-3 hover:border-accent">
                <span className="font-medium">{b.name}</span>
                <span className="text-xs tabular-nums text-faint">{b.videoCount}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={t.common.none} />
      )}
    </>
  );
}
