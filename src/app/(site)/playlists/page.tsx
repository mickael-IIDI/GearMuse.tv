import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { label } from "@/lib/i18n";
import { getI18n } from "@/server/locale";
import { playlistSummaries, type PlaylistSummary } from "@/server/queries/catalog";
import { Mosaic } from "@/components/video/mosaic";

export const metadata: Metadata = {
  title: "Playlists",
  description: "Des parcours thématiques ordonnés : moteurs extraordinaires, grandes restaurations, moteurs à réaction, bateaux impressionnants…",
  alternates: { canonical: "/playlists" },
};

function PlaylistCard({ p, locale }: { p: PlaylistSummary; locale: string }) {
  const en = locale === "en";
  return (
    <Link href={`/playlists/${p.slug}`} className="group block">
      <div className="relative">
        <Mosaic covers={p.covers} />
        <span className="absolute bottom-2 right-2 rounded bg-black/80 px-2 py-0.5 text-xs font-semibold text-white">
          {p.count} {en ? "videos" : "vidéos"}
          {p.minutes ? ` · ${p.minutes >= 60 ? `${Math.floor(p.minutes / 60)} h ${String(p.minutes % 60).padStart(2, "0")}` : `${p.minutes} min`}` : ""}
        </span>
      </div>
      <h3 className="mt-2.5 font-display text-[16px] font-semibold group-hover:text-accent">{label(p.titles, locale)}</h3>
      {p.pitches && <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{label(p.pitches, locale)}</p>}
    </Link>
  );
}

export default async function PlaylistsPage() {
  const { t, locale } = await getI18n();
  const en = locale === "en";
  const list = await playlistSummaries({ minItems: 3 });
  const start = list.filter((p) => p.tier === "start");
  const deep = list.filter((p) => p.tier === "deep");
  return (
    <>
      <PageHeader
        title={t.nav.playlists}
        subtitle={en ? "Thematic paths built from the catalog, in a deliberate order. Playlists with fewer than three published videos are hidden." : "Des parcours thématiques construits à partir du catalogue, dans un ordre réfléchi. Les playlists de moins de trois vidéos publiées sont masquées."}
      />
      {!list.length && <EmptyState title={t.common.none} />}
      {start.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 font-display text-lg font-semibold">{en ? "Start here" : "Pour commencer"}</h2>
          <div className="video-grid">{start.map((p) => <PlaylistCard key={p.slug} p={p} locale={locale} />)}</div>
        </section>
      )}
      {deep.length > 0 && (
        <section>
          <h2 className="mb-4 font-display text-lg font-semibold">{en ? "Deep dives" : "Pour aller plus loin"}</h2>
          <div className="video-grid">{deep.map((p) => <PlaylistCard key={p.slug} p={p} locale={locale} />)}</div>
        </section>
      )}
    </>
  );
}
