import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { label } from "@/lib/i18n";
import { getI18n } from "@/server/locale";
import { categoryTree } from "@/server/queries/catalog";

export const metadata: Metadata = {
  title: "Technologies et thématiques",
  description: "Mécanique, motorisation, électrique, hydrogène, vapeur, aérodynamique, fabrication : explorez les thèmes transversaux à tous les véhicules.",
  alternates: { canonical: "/technologies" },
};

function Tile({ href, title, count, desc }: { href: string; title: string; count: number; desc?: string }) {
  return (
    <Link href={href} className={`group rounded-2xl border border-line bg-elev p-4 transition-colors hover:border-accent ${count === 0 ? "opacity-60" : ""}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-[16px] font-semibold group-hover:text-accent">{title}</span>
        <span className="text-xs tabular-nums text-faint">{count}</span>
      </div>
      {desc && <p className="mt-1 text-[13px] text-muted">{desc}</p>}
    </Link>
  );
}

export default async function TechnologiesPage() {
  const { t, locale } = await getI18n();
  const en = locale === "en";
  const tree = await categoryTree();
  return (
    <>
      <PageHeader title={t.nav.technologies} subtitle={en ? "Cross-cutting topics shared by every kind of vehicle." : "Les thématiques transversales, communes à tous les véhicules."} />
      <h2 className="mb-3 mt-2 font-display text-lg font-semibold">{en ? "Propulsion" : "Propulsion"}</h2>
      <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {tree.technologies.map((c) => (
          <Tile key={c.slug} href={`/technologies/${c.slug.replace("techno-", "")}`} title={label(c.labels, locale)} count={c.videoCount} />
        ))}
      </div>
      <h2 className="mb-3 font-display text-lg font-semibold">{en ? "Themes" : "Thèmes"}</h2>
      <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tree.themes.map((c) => (
          <Tile key={c.slug} href={`/themes/${c.slug}`} title={label(c.labels, locale)} count={c.videoCount} />
        ))}
      </div>
      <h2 className="mb-3 font-display text-lg font-semibold">{en ? "Formats" : "Formats"}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {tree.formats.map((c) => (
          <Tile key={c.slug} href={`/videos?format=${c.slug.replace("format-", "")}`} title={label(c.labels, locale)} count={c.videoCount} />
        ))}
      </div>
    </>
  );
}
