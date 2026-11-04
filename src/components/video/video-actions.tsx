"use client";

import { library, toast, useLibrary } from "@/components/library/store";
import { useI18n } from "@/components/locale-provider";
import { IconCheck, IconClock, IconExternal, IconHeart, IconShare } from "@/components/icons";

export function VideoActions({ externalId, title, url }: { externalId: string; title: string; url: string }) {
  const { t } = useI18n();
  const lib = useLibrary();
  const fav = lib.favorites.includes(externalId);
  const later = lib.later.includes(externalId);
  const pill = "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors";
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast(t.video.copied);
      }
    } catch {
      /* partage annulé */
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" aria-pressed={fav} onClick={() => toast(library.toggle("favorites", externalId) ? t.card.favoriteSaved : t.library.remove)} className={`${pill} ${fav ? "bg-[var(--chip-active-bg)] text-[var(--chip-active-text)]" : "bg-soft hover:bg-hover"}`}>
        <IconHeart size={17} filled={fav} /> {fav ? t.card.favoriteSaved : t.card.favorite}
      </button>
      <button type="button" aria-pressed={later} onClick={() => toast(library.toggle("later", externalId) ? t.card.laterSaved : t.library.remove)} className={`${pill} ${later ? "bg-[var(--chip-active-bg)] text-[var(--chip-active-text)]" : "bg-soft hover:bg-hover"}`}>
        {later ? <IconCheck size={17} /> : <IconClock size={17} />} {later ? t.card.laterSaved : t.card.later}
      </button>
      <button type="button" onClick={share} className={`${pill} bg-soft hover:bg-hover`}>
        <IconShare size={17} /> {t.video.share}
      </button>
      <a href={`https://www.youtube.com/watch?v=${externalId}`} target="_blank" rel="noopener noreferrer" className={`${pill} bg-soft hover:bg-hover`}>
        YouTube <IconExternal size={15} />
      </a>
    </div>
  );
}

export function Expandable({ text, more, less }: { text: string; more: string; less: string }) {
  return (
    <details className="group mt-3">
      <summary className="cursor-pointer list-none text-sm font-semibold text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">{more}</span>
        <span className="hidden group-open:inline">{less}</span>
      </summary>
      <p className="mt-2 whitespace-pre-line break-words text-[13.5px] text-muted">{text}</p>
    </details>
  );
}
