"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { library, toast, useLibrary } from "@/components/library/store";
import { useI18n } from "@/components/locale-provider";
import { useHydrated } from "@/components/use-hydrated";
import { fetchRecommendations } from "@/components/video/for-you-section";
import { VideoCard } from "@/components/video/video-card";
import { PageHeader } from "@/components/ui/page-header";
import { IconEyeOff } from "@/components/icons";
import type { VideoCard as Card } from "@/server/queries/videos";

type Feed = { key: string; items: Card[]; personalized: boolean; page: number };

export function ForYouFeed() {
  const { t, locale } = useI18n();
  const lib = useLibrary();
  const hydrated = useHydrated();
  const key = `${locale}|${lib.seed}|${lib.prefs.universes.join(",")}|${lib.prefs.formats.join(",")}|${lib.favorites.length}`;
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    fetchRecommendations(library.get(), locale, 1)
      .then((r) => !cancelled && setFeed({ key, items: r.items, personalized: r.personalized, page: 1 }))
      .catch(() => !cancelled && setFeed({ key, items: [], personalized: true, page: 1 }));
    return () => {
      cancelled = true;
    };
  }, [hydrated, key, locale]);

  const current = feed?.key === key ? feed : null;
  const loading = !current || loadingMore;

  const more = async () => {
    if (!current) return;
    setLoadingMore(true);
    try {
      const r = await fetchRecommendations(library.get(), locale, current.page + 1);
      setFeed((f) => (f && f.key === key ? { ...f, page: f.page + 1, items: [...f.items, ...r.items.filter((x) => !f.items.some((y) => y.id === x.id))] } : f));
    } finally {
      setLoadingMore(false);
    }
  };

  const visible = (current?.items ?? []).filter((v) => !lib.hidden.includes(v.externalId));
  return (
    <>
      <PageHeader title={t.forYou.title} subtitle={t.forYou.intro} />
      {current && !current.personalized && (
        <p className="mb-6 rounded-xl border border-line bg-elev px-4 py-3 text-sm text-muted">
          {t.forYou.coldStart}{" "}
          <Link href="/parametres" className="text-link underline">{t.nav.settings}</Link>
        </p>
      )}
      <div className="video-grid">
        {visible.map((v) => (
          <div key={v.id}>
            <VideoCard v={v} locale={locale} />
            <button
              type="button"
              onClick={() => {
                library.toggle("hidden", v.externalId);
                toast(t.forYou.hide);
              }}
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-faint hover:text-fg"
            >
              <IconEyeOff size={14} /> {t.forYou.hide}
            </button>
          </div>
        ))}
      </div>
      {loading && <p className="mt-8 text-center text-sm text-muted">{t.common.loading}</p>}
      {!loading && visible.length > 0 && (current?.page ?? 1) < 20 && (
        <div className="mt-8 flex justify-center">
          <button type="button" onClick={more} className="rounded-full border border-line px-5 py-2 text-sm font-medium hover:bg-hover">{t.forYou.more}</button>
        </div>
      )}
    </>
  );
}
