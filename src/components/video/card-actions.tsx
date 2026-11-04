"use client";

import { library, toast, useLibrary } from "@/components/library/store";
import { useI18n } from "@/components/locale-provider";
import { IconCheck, IconClock, IconHeart } from "@/components/icons";

/** Boutons « Regarder plus tard » et « Favori » superposés à la miniature. */
export function CardActions({ externalId }: { externalId: string }) {
  const { t } = useI18n();
  const lib = useLibrary();
  const later = lib.later.includes(externalId);
  const fav = lib.favorites.includes(externalId);
  const btn = "grid size-8 place-items-center rounded-md bg-black/75 text-white backdrop-blur transition-opacity hover:bg-black/90 focus-visible:opacity-100";
  return (
    <div className="absolute right-1.5 top-1.5 flex flex-col gap-1.5">
      <button
        type="button"
        aria-pressed={later}
        aria-label={later ? t.card.laterSaved : t.card.later}
        title={later ? t.card.laterSaved : t.card.later}
        onClick={() => toast(library.toggle("later", externalId) ? t.card.laterSaved : t.library.remove)}
        className={`${btn} ${later ? "opacity-100" : "opacity-0 group-hover/thumb:opacity-100 max-md:opacity-100"}`}
      >
        {later ? <IconCheck size={17} /> : <IconClock size={17} />}
      </button>
      <button
        type="button"
        aria-pressed={fav}
        aria-label={fav ? t.card.favoriteSaved : t.card.favorite}
        title={fav ? t.card.favoriteSaved : t.card.favorite}
        onClick={() => toast(library.toggle("favorites", externalId) ? t.card.favoriteSaved : t.library.remove)}
        className={`${btn} ${fav ? "text-[var(--accent)] opacity-100" : "opacity-0 group-hover/thumb:opacity-100 max-md:opacity-100"}`}
      >
        <IconHeart size={17} filled={fav} />
      </button>
    </div>
  );
}
