import type { PlaylistSummary } from "@/server/queries/catalog";

/** Mosaïque 2×2 de miniatures officielles pour les playlists. */
export function Mosaic({ covers }: { covers: PlaylistSummary["covers"] }) {
  const cells = [...covers, ...Array(Math.max(0, 4 - covers.length)).fill(null)].slice(0, 4);
  return (
    <div className="grid aspect-video grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-[var(--radius-thumb)] bg-soft">
      {cells.map((c, i) =>
        c ? (
          // eslint-disable-next-line @next/next/no-img-element -- miniatures officielles YouTube
          <img key={i} src={c.thumbnailUrl ?? `https://i.ytimg.com/vi/${c.externalId}/mqdefault.jpg`} alt="" loading="lazy" className="size-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div key={i} className="bg-hover" />
        ),
      )}
    </div>
  );
}
