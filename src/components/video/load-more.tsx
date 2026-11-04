"use client";

import { useEffect, useRef, useState } from "react";
import type { VideoCard as Card } from "@/server/queries/videos";
import { useI18n } from "@/components/locale-provider";
import { VideoCard } from "./video-card";

/**
 * Chargement progressif (défilement infini avec bouton de repli accessible).
 * Le parent passe `key={query}` : un changement de filtres recrée le composant.
 */
export function LoadMore({ endpoint, query, startPage = 2, initialHasMore, variant = "grid" }: { endpoint: string; query: string; startPage?: number; initialHasMore: boolean; variant?: "grid" | "row" }) {
  const { t, locale } = useI18n();
  const [items, setItems] = useState<Card[]>([]);
  const [page, setPage] = useState(startPage);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setError(false);
    try {
      const p = new URLSearchParams(query);
      p.set("page", String(page));
      const r = await fetch(`${endpoint}?${p}`);
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { items: Card[]; hasMore: boolean };
      setItems((s) => [...s, ...j.items.filter((x) => !s.some((y) => y.id === x.id))]);
      setHasMore(j.hasMore);
      setPage((n) => n + 1);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && load(), { rootMargin: "800px" });
    io.observe(el);
    return () => io.disconnect();
  });

  return (
    <>
      {items.length > 0 &&
        (variant === "row" ? (
          <div className="mt-6 flex flex-col gap-5">{items.map((v) => <VideoCard key={v.id} v={v} locale={locale} variant="row" />)}</div>
        ) : (
          <div className="video-grid mt-8">{items.map((v) => <VideoCard key={v.id} v={v} locale={locale} />)}</div>
        ))}
      {hasMore && (
        <div ref={sentinel} className="mt-8 flex justify-center">
          <button type="button" onClick={load} disabled={loading} className="rounded-full border border-line px-5 py-2 text-sm font-medium hover:bg-hover disabled:opacity-60">
            {loading ? t.common.loading : error ? t.common.error : t.common.loadMore}
          </button>
        </div>
      )}
    </>
  );
}
