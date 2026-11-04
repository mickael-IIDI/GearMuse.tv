import type { Metadata } from "next";
import Link from "next/link";
import { UNIVERSE_ICONS } from "@/components/icons";
import { PageHeader } from "@/components/ui/page-header";
import { label } from "@/lib/i18n";
import { getI18n } from "@/server/locale";
import { brandList, categoryTree } from "@/server/queries/catalog";

export const metadata: Metadata = {
  title: "Catégories",
  description: "Toutes les catégories du catalogue : automobile, moto, aviation, bateaux et autres véhicules, avec leurs sous-catégories et marques.",
  alternates: { canonical: "/categories" },
};

export default async function CategoriesPage() {
  const { t, locale } = await getI18n();
  const en = locale === "en";
  const [tree, brands] = await Promise.all([categoryTree(), brandList(1)]);
  return (
    <>
      <PageHeader title={t.nav.categories} subtitle={en ? "Five universes, their sub-categories, and the brands present in the catalog." : "Cinq univers, leurs sous-catégories et les marques présentes dans le catalogue."} />
      <div className="mb-8 flex flex-wrap gap-2">
        <Link href="/videos?tri=recent" className="rounded-full bg-soft px-4 py-2 text-sm font-medium hover:bg-hover">{en ? "Recently added" : "Ajouts récents"}</Link>
        <Link href="/videos/longues" className="rounded-full bg-soft px-4 py-2 text-sm font-medium hover:bg-hover">{t.nav.long}</Link>
        <Link href="/decouvertes" className="rounded-full bg-soft px-4 py-2 text-sm font-medium hover:bg-hover">{t.nav.discoveries}</Link>
        <Link href="/videos" className="rounded-full bg-soft px-4 py-2 text-sm font-medium hover:bg-hover">{t.nav.all}</Link>
      </div>
      <div className="columns-1 gap-4 md:columns-2 2xl:columns-3">
        {tree.universes.map((u) => {
          const Icon = UNIVERSE_ICONS[u.slug];
          return (
            <section key={u.slug} className="mb-4 break-inside-avoid rounded-2xl bg-soft p-5">
              <Link href={`/univers/${u.slug}`} className="flex items-center gap-3 hover:text-accent">
                {Icon && <span style={{ color: u.color ?? undefined }}><Icon size={22} /></span>}
                <h2 className="font-display text-lg font-semibold">{label(u.labels, locale)}</h2>
                <span className="ml-auto text-sm tabular-nums text-faint">{u.videoCount}</span>
              </Link>
              <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                {u.subs.map((s) => (
                  <li key={s.slug}>
                    <Link href={`/univers/${u.slug}/${s.slug}`} className={`flex items-baseline justify-between gap-2 rounded px-1 py-0.5 text-[13.5px] hover:bg-hover ${s.videoCount ? "" : "text-faint"}`}>
                      <span>{label(s.labels, locale)}</span>
                      <span className="text-xs tabular-nums text-faint">{s.videoCount}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      {brands.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-lg font-semibold">{t.nav.brands}</h2>
            <Link href="/marques" className="text-sm text-muted hover:text-fg">{t.home.seeAll} →</Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {brands.slice(0, 40).map((b) => (
              <Link key={b.slug} href={`/marques/${b.slug}`} className="rounded-lg bg-soft px-3 py-1.5 text-[13.5px] hover:bg-hover">
                {b.name} <span className="text-xs text-faint">{b.videoCount}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
