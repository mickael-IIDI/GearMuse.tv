"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { library, setUiCookie, toast, useLibrary } from "@/components/library/store";
import { useI18n } from "@/components/locale-provider";
import { FILTER_GROUPS } from "@/lib/filters";

const UNIVERSES: [string, string, string][] = [
  ["automobile", "Automobile", "Cars"],
  ["moto", "Moto", "Motorcycles"],
  ["aviation", "Aviation", "Aviation"],
  ["nautisme", "Bateaux", "Boats & ships"],
  ["autres-vehicules", "Autres véhicules", "Other vehicles"],
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line py-6 first:pt-0">
      <h2 className="mb-3 font-display text-[16px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function SettingsForm({ theme }: { theme: string }) {
  const { t, locale } = useI18n();
  const en = locale === "en";
  const router = useRouter();
  const lib = useLibrary();
  const [mode, setMode] = useState(theme);
  const file = useRef<HTMLInputElement>(null);

  const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const chip = (on: boolean) => `rounded-full border px-4 py-1.5 text-sm ${on ? "border-transparent bg-[var(--chip-active-bg)] text-[var(--chip-active-text)]" : "border-line hover:bg-hover"}`;

  return (
    <div className="max-w-3xl">
      <Section title={t.settings.theme}>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.settings.theme}>
          {(["dark", "light", "system"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              className={chip(mode === m)}
              onClick={() => {
                setMode(m);
                document.documentElement.dataset.theme = m;
                setUiCookie("theme", m);
                toast(t.settings.saved);
              }}
            >
              {m === "dark" ? t.settings.dark : m === "light" ? t.settings.light : t.settings.system}
            </button>
          ))}
        </div>
      </Section>

      <Section title={t.settings.language}>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.settings.language}>
          {([["fr", "Français"], ["en", "English"]] as const).map(([l, name]) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={locale === l}
              className={chip(locale === l)}
              onClick={() => {
                setUiCookie("lang", l);
                router.refresh();
              }}
            >
              {name}
            </button>
          ))}
        </div>
      </Section>

      <Section title={t.settings.universes}>
        <div className="flex flex-wrap gap-2">
          {UNIVERSES.map(([slug, fr, enL]) => {
            const on = lib.prefs.universes.includes(slug);
            return (
              <button key={slug} type="button" aria-pressed={on} className={chip(on)} onClick={() => library.setPrefs({ universes: toggleIn(lib.prefs.universes, slug) })}>
                {en ? enL : fr}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title={t.settings.formats}>
        <div className="flex flex-wrap gap-2">
          {FILTER_GROUPS.format.map(([slug, fr, enL]) => {
            const on = lib.prefs.formats.includes(slug);
            return (
              <button key={slug} type="button" aria-pressed={on} className={chip(on)} onClick={() => library.setPrefs({ formats: toggleIn(lib.prefs.formats, slug) })}>
                {en ? enL : fr}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title={t.settings.duration}>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.settings.duration}>
          <button type="button" role="radio" aria-checked={!lib.prefs.duration} className={chip(!lib.prefs.duration)} onClick={() => library.setPrefs({ duration: null })}>
            {t.settings.any}
          </button>
          {FILTER_GROUPS.duree.map(([slug, fr, enL]) => (
            <button key={slug} type="button" role="radio" aria-checked={lib.prefs.duration === slug} className={chip(lib.prefs.duration === slug)} onClick={() => library.setPrefs({ duration: slug })}>
              {en ? enL : fr}
            </button>
          ))}
        </div>
      </Section>

      <Section title={t.settings.history}>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={lib.prefs.historyEnabled} onChange={(e) => library.setPrefs({ historyEnabled: e.target.checked })} />
          {t.settings.historyEnabled}
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={chip(false)} onClick={() => { library.clearHistory(); toast(t.settings.saved); }}>{t.settings.clearHistory}</button>
          <button type="button" className={chip(false)} onClick={() => { library.resetRecommendations(); toast(t.settings.resetDone); }}>{t.settings.resetReco}</button>
        </div>
      </Section>

      <Section title={t.settings.player}>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={lib.prefs.autoLoadPlayer} onChange={(e) => library.setPrefs({ autoLoadPlayer: e.target.checked })} />
          {t.settings.autoLoad}
        </label>
        <p className="mt-2 text-xs text-muted">{t.video.playerConsent}</p>
      </Section>

      <Section title={en ? "Local data" : "Données locales"}>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={chip(false)}
            onClick={() => {
              const blob = new Blob([library.exportJson()], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `bibliotheque-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            {t.settings.export}
          </button>
          <button type="button" className={chip(false)} onClick={() => file.current?.click()}>{t.settings.import}</button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                library.importJson(await f.text());
                toast(t.settings.importDone);
              } catch {
                toast(t.settings.importError);
              }
              e.target.value = "";
            }}
          />
        </div>
        <p className="mt-3 text-xs text-muted">
          {en ? `${lib.favorites.length} favorites · ${lib.later.length} watch later · ${lib.history.length} in history` : `${lib.favorites.length} favoris · ${lib.later.length} à regarder plus tard · ${lib.history.length} dans l'historique`}
        </p>
        <p className="mt-2 text-xs text-muted">{t.settings.privacy}</p>
      </Section>
    </div>
  );
}
