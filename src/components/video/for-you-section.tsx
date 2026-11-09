"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLibrary, type LibraryState } from "@/components/library/store";
import { useI18n } from "@/components/locale-provider";
import { useVideoLanguage } from "@/components/video-language/provider";
import type { VideoCard as Card } from "@/server/queries/videos";
import { VideoCard } from "./video-card";

export async function fetchRecommendations(lib: LibraryState, locale: string, page = 1, language?: string | null): Promise<{ items: Card[]; personalized: boolean }> {
  const r = await fetch("/api/recommandations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      favorites: lib.favorites.slice(0, 300),
      later: lib.later.slice(0, 300),
      history: lib.history.map((h) => h.id).slice(0, 300),
      hidden: lib.hidden.slice(0, 300),
      prefs: { universes: lib.prefs.universes, formats: lib.prefs.formats, duration: lib.prefs.duration },
      seed: lib.seed,
      page,
      locale,
      language: language ?? undefined,
    }),
  });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

/** Section d'accueil personnalisée, affichée seulement si le visiteur a des signaux locaux. */
export function ForYouSection() {
  const { t, locale } = useI18n();
  const lib = useLibrary();
  const { current: language } = useVideoLanguage();
  const [items, setItems] = useState<Card[] | null>(null);
  const hasSignals = lib.favorites.length + lib.history.length + lib.later.length + lib.prefs.universes.length > 0;
  const key = `${lib.favorites.length}-${lib.history.length}-${lib.later.length}-${lib.prefs.universes.join(",")}-${lib.seed}-${language ?? ""}`;

  useEffect(() => {
    if (!hasSignals) return;
    let cancelled = false;
    fetchRecommendations(lib, locale, 1, language)
      .then((r) => !cancelled && setItems(r.items.slice(0, 8)))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recalcul seulement quand le profil change
  }, [key, locale, hasSignals]);

  if (!hasSignals || !items?.length) return null;
  return (
    <section className="mb-12" aria-label={t.home.forYou}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="font-display text-[21px] font-bold tracking-tight">{t.home.forYou}</h2>
        <Link href="/pour-vous" className="shrink-0 text-sm font-medium text-muted hover:text-fg">{t.home.seeAll} →</Link>
      </div>
      <div className="video-grid">{items.map((v) => <VideoCard key={v.id} v={v} locale={locale} />)}</div>
    </section>
  );
}
