"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { FILTER_GROUPS, SORTS, type FilterKey } from "@/lib/filters";
import { useI18n } from "@/components/locale-provider";
import { IconFilter, IconX } from "@/components/icons";
import { LanguagePicker } from "@/components/video-language/picker";

/**
 * Barre de filtres façon panneau YouTube : un choix par groupe, combinables,
 * conservés dans l'URL (partageable). Cliquer sur l'option active la retire.
 */
export function FilterBar({
  groups = ["date", "duree", "format", "techno", "qualite"],
  search = false,
  durationKnownPct,
  locked = [],
}: {
  groups?: FilterKey[];
  search?: boolean;
  durationKnownPct?: number;
  /** Paramètres fixés par la page (ex. durée pour « Vidéos longues ») : non modifiables ici. */
  locked?: string[];
}) {
  const { t, locale } = useI18n();
  const en = locale === "en";
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);

  const set = (key: string, value: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (value === null || p.get(key) === value) p.delete(key);
    else p.set(key, value);
    p.delete("page");
    router.push(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false });
    setOpen(false);
  };

  const groupLabel = (g: FilterKey) => (t.filters as Record<string, unknown>)[g] as string;
  const active = groups.filter((g) => params.get(g) && !locked.includes(g));
  const sorts = SORTS.filter((s) => search || s[0] !== "pertinence");
  const sort = params.get("tri");

  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-center gap-2">
        <LanguagePicker />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={`inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium ${open ? "border-transparent bg-[var(--chip-active-bg)] text-[var(--chip-active-text)]" : "border-line bg-soft hover:bg-hover"}`}
        >
          <IconFilter size={17} /> {t.filters.button}
          {active.length + (sort ? 1 : 0) > 0 && <span className="rounded-full bg-accent px-1.5 text-xs text-accent-ink">{active.length + (sort ? 1 : 0)}</span>}
        </button>
        {active.map((g) => {
          const v = params.get(g)!;
          const opt = (FILTER_GROUPS[g] as readonly (readonly string[])[]).find((o) => o[0] === v);
          return (
            <button key={g} type="button" onClick={() => set(g, null)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--chip-active-bg)] px-3.5 text-sm font-medium text-[var(--chip-active-text)]" aria-label={`${en ? "Remove filter" : "Retirer le filtre"} ${opt?.[en ? 2 : 1] ?? v}`}>
              {opt?.[en ? 2 : 1] ?? v} <IconX size={14} />
            </button>
          );
        })}
        {sort && (
          <button type="button" onClick={() => set("tri", null)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--chip-active-bg)] px-3.5 text-sm font-medium text-[var(--chip-active-text)]">
            {sorts.find((s) => s[0] === sort)?.[en ? 2 : 1] ?? sort} <IconX size={14} />
          </button>
        )}
        {(active.length > 0 || sort) && (
          <button type="button" onClick={() => router.push(pathname + (params.get("q") ? `?q=${encodeURIComponent(params.get("q")!)}` : ""), { scroll: false })} className="h-9 px-2 text-sm text-muted hover:text-fg">
            {t.filters.clear}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 grid gap-x-6 gap-y-4 rounded-xl border border-line bg-elev p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          {groups.filter((g) => !locked.includes(g)).map((g) => (
            <fieldset key={g} className="min-w-0">
              <legend className="mb-2 border-b border-line pb-2 text-xs font-semibold uppercase tracking-wide text-faint">{groupLabel(g)}</legend>
              <div className="flex flex-col items-start gap-0.5">
                {(FILTER_GROUPS[g] as readonly (readonly string[])[]).map((o) => {
                  const on = params.get(g) === o[0];
                  return (
                    <button key={o[0]} type="button" onClick={() => set(g, o[0])} aria-pressed={on} className={`rounded-md px-2 py-1 text-left text-[13.5px] ${on ? "bg-[var(--chip-active-bg)] font-medium text-[var(--chip-active-text)]" : "text-fg/85 hover:bg-hover"}`}>
                      {en ? o[2] : o[1]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
          <fieldset className="min-w-0">
            <legend className="mb-2 border-b border-line pb-2 text-xs font-semibold uppercase tracking-wide text-faint">{t.filters.tri}</legend>
            <div className="flex flex-col items-start gap-0.5">
              {sorts.map((s) => {
                const on = sort === s[0];
                return (
                  <button key={s[0]} type="button" onClick={() => set("tri", s[0])} aria-pressed={on} className={`rounded-md px-2 py-1 text-left text-[13.5px] ${on ? "bg-[var(--chip-active-bg)] font-medium text-[var(--chip-active-text)]" : "text-fg/85 hover:bg-hover"}`}>
                    {en ? s[2] : s[1]}
                  </button>
                );
              })}
            </div>
          </fieldset>
          {durationKnownPct != null && durationKnownPct < 100 && <p className="text-xs text-muted sm:col-span-2 lg:col-span-4 xl:col-span-7">{t.filters.durationNotice(durationKnownPct)}</p>}
        </div>
      )}
    </div>
  );
}
