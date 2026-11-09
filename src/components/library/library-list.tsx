"use client";

import { useEffect, useMemo, useState } from "react";
import { library, useLibrary } from "@/components/library/store";
import { useI18n } from "@/components/locale-provider";
import { useHydrated } from "@/components/use-hydrated";
import { VideoCard } from "@/components/video/video-card";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { IconX } from "@/components/icons";
import { LanguagePicker, LanguageResetButton } from "@/components/video-language/picker";
import { useVideoLanguage } from "@/components/video-language/provider";
import type { VideoCard as Card } from "@/server/queries/videos";

/** Listes locales (favoris, historique, à regarder plus tard), les plus récentes d'abord. */
export function LibraryList({ mode }: { mode: "favorites" | "history" | "later" }) {
  const { t, locale } = useI18n();
  const lib = useLibrary();
  const hydrated = useHydrated();
  const { current: language } = useVideoLanguage();
  const ids = useMemo(() => (mode === "history" ? lib.history.map((h) => h.id) : lib[mode]), [lib, mode]);
  // Valeur null = identifiant demandé mais absent du catalogue.
  const [cards, setCards] = useState<Map<string, Card | null>>(new Map());
  const missing = ids.filter((i) => !cards.has(i));
  const missingKey = missing.join(",");

  useEffect(() => {
    if (!hydrated || !missingKey) return;
    let cancelled = false;
    const wanted = missingKey.split(",");
    fetch("/api/videos/by-ids", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: wanted }) })
      .then((r) => r.json())
      .then((j: { items: Card[] }) => {
        if (cancelled) return;
        const found = new Map(j.items.map((c) => [c.externalId, c] as const));
        setCards((m) => new Map([...m, ...wanted.map((id) => [id, found.get(id) ?? null] as const)]));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hydrated, missingKey]);

  const title = mode === "favorites" ? t.library.favoritesTitle : mode === "history" ? t.library.historyTitle : t.library.laterTitle;
  const empty = mode === "favorites" ? t.library.emptyFavorites : mode === "history" ? t.library.emptyHistory : t.library.emptyLater;
  const list = ids.map((i) => cards.get(i)).filter((x): x is Card => Boolean(x) && (!language || x?.language === language));
  const loading = !hydrated || (missing.length > 0 && !list.length);

  return (
    <>
      <PageHeader title={title} subtitle={t.library.localNotice}>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <LanguagePicker />
          {mode === "history" && lib.history.length > 0 && (
            <button type="button" onClick={() => library.clearHistory()} className="rounded-full border border-line px-4 py-1.5 text-sm hover:bg-hover">{t.library.clearHistory}</button>
          )}
        </div>
        {mode === "history" && !lib.prefs.historyEnabled && <p className="mt-2 text-sm text-muted">{t.library.historyPaused}</p>}
      </PageHeader>
      {hydrated && !ids.length ? (
        <EmptyState title={empty} />
      ) : loading ? (
        <p className="text-sm text-muted">{t.library.loading}</p>
      ) : language && !list.length ? (
        <EmptyState title={t.videoLanguage.empty}>
          <LanguageResetButton />
        </EmptyState>
      ) : (
        <div className="video-grid">
          {list.map((v) => (
            <div key={v.externalId}>
              <VideoCard v={v} locale={locale} />
              <button
                type="button"
                onClick={() => (mode === "history" ? library.removeHistory(v.externalId) : library.remove(mode, v.externalId))}
                className="mt-2 inline-flex items-center gap-1 text-xs text-faint hover:text-fg"
              >
                <IconX size={13} /> {t.library.remove}
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
