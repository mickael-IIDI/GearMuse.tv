import Link from "next/link";
import type { VideoCard as Card } from "@/server/queries/videos";
import { formatDuration } from "@/lib/text";
import { label } from "@/lib/i18n";
import { CardActions } from "./card-actions";
import { RelativeDate } from "@/components/ui/relative-date";

/**
 * Carte vidéo. Miniature officielle du fournisseur (aucune capture générée),
 * durée, titre original, chaîne, date, univers, indicateurs éditoriaux.
 */
export function VideoCard({ v, locale, variant = "grid", priority = false }: { v: Card; locale: string; variant?: "grid" | "row" | "compact"; priority?: boolean }) {
  const en = locale === "en";
  const href = `/video/${v.slug}`;
  const thumb = v.thumbnailUrl ?? `https://i.ytimg.com/vi/${v.externalId}/hqdefault.jpg`;
  const unavailable = v.availability === "unavailable" || v.availability === "private";
  const uni = v.universe;
  const sub = v.subcategories[0];
  const gem = (v.discoveryScore ?? 0) >= 30;
  const reason = v.reason ?? v.selectionReason ?? undefined;

  const meta = (
    <div className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted">
      {v.creator && <span className="truncate">{v.creator.name}</span>}
      {v.creator && (v.publishedAt || v.viewCount != null) && <span aria-hidden>·</span>}
      {v.viewCount != null && <span>{new Intl.NumberFormat(en ? "en" : "fr-FR", { notation: "compact" }).format(v.viewCount)} {en ? "views" : "vues"}</span>}
      {v.viewCount != null && v.publishedAt && <span aria-hidden>·</span>}
      {v.publishedAt && <RelativeDate iso={v.publishedAt} />}
    </div>
  );

  const badges = (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px]">
      {uni && (
        <Link href={sub ? `/univers/${sub.universe}/${sub.slug}` : `/univers/${uni.slug}`} className="inline-flex items-center gap-1.5 rounded-md bg-soft px-2 py-0.5 text-muted hover:text-fg">
          <span className="size-1.5 rounded-full" style={{ background: uni.color ?? "var(--accent)" }} aria-hidden />
          {sub ? label(sub.labels, locale) : label(uni.labels, locale)}
        </Link>
      )}
      {v.editorialPick && <span className="rounded-md bg-accent-soft px-2 py-0.5 font-semibold text-accent">★ {en ? "Editor's pick" : "Sélection"}</span>}
      {gem && <span className="rounded-md bg-accent-soft px-2 py-0.5 font-medium text-accent" title={en ? "Recommended but little watched" : "Recommandée mais peu vue"}>{en ? "Hidden gem" : "Pépite"}</span>}
      {v.qualityScore != null && (
        <span
          className="rounded-md border border-line px-1.5 py-0.5 tabular-nums text-muted"
          title={en ? "Internal quality score out of 100 (algorithmic). See About." : "Note qualitative interne sur 100, calculée par l'algorithme de sélection. Voir « À propos »."}
        >
          {en ? "Score" : "Note"} {v.qualityScore}
        </span>
      )}
      {v.language && v.language !== locale && <span className="rounded-md border border-line px-1.5 py-0.5 uppercase text-faint">{v.language}</span>}
    </div>
  );

  const thumbBlock = (
    <div className="group/thumb relative aspect-video overflow-hidden rounded-[var(--radius-thumb)] bg-soft">
      <Link href={href} tabIndex={-1} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element -- miniature officielle servie par YouTube, non transformée */}
        <img
          src={thumb}
          alt=""
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          className={`size-full object-cover transition-transform duration-300 group-hover/thumb:scale-[1.03] ${unavailable ? "opacity-40 grayscale" : ""}`}
        />
      </Link>
      {v.durationSeconds != null && (
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[12px] font-semibold tabular-nums text-white">{formatDuration(v.durationSeconds)}</span>
      )}
      {unavailable && <span className="absolute left-2 top-2 rounded bg-black/80 px-2 py-0.5 text-xs font-medium text-white">{en ? "Unavailable" : "Indisponible"}</span>}
      <CardActions externalId={v.externalId} />
    </div>
  );

  if (variant === "row" || variant === "compact") {
    return (
      <article className={`flex gap-3 ${variant === "row" ? "sm:gap-4" : ""}`}>
        <div className={variant === "row" ? "w-[42%] max-w-[360px] shrink-0" : "w-[168px] shrink-0"}>{thumbBlock}</div>
        <div className="min-w-0 flex-1">
          <h3 className={`line-clamp-2 font-medium leading-snug ${variant === "row" ? "text-[16px] sm:text-[17px]" : "text-[14px]"}`}>
            <Link href={href} className="hover:text-accent">{v.title}</Link>
          </h3>
          <div className="mt-1">{meta}</div>
          {variant === "row" && (v.editorialSummary || reason) && <p className="mt-1.5 line-clamp-2 text-[13px] text-muted">{v.editorialSummary || reason}</p>}
          {variant === "row" ? badges : v.note ? <p className="mt-1 line-clamp-2 text-[12.5px] text-muted">{v.note}</p> : null}
        </div>
      </article>
    );
  }

  return (
    <article className="min-w-0">
      {thumbBlock}
      <div className="mt-2.5 min-w-0">
        <h3 className="line-clamp-2 text-[15.5px] font-medium leading-snug" title={reason}>
          <Link href={href} className="hover:text-accent">{v.title}</Link>
        </h3>
        <div className="mt-1">{meta}</div>
        {v.reason && <p className="mt-1 line-clamp-1 text-[12.5px] text-accent/90">{v.reason}</p>}
        {badges}
      </div>
    </article>
  );
}

export function VideoGrid({ items, locale, priorityCount = 4 }: { items: Card[]; locale: string; priorityCount?: number }) {
  return (
    <div className="video-grid">
      {items.map((v, i) => (
        <VideoCard key={v.id} v={v} locale={locale} priority={i < priorityCount} />
      ))}
    </div>
  );
}
