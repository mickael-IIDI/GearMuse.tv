"use client";

import { useSyncExternalStore } from "react";

/**
 * Bibliothèque locale du visiteur (sans compte) : favoris, à regarder plus tard,
 * historique, vidéos masquées et préférences. Stockage : localStorage uniquement.
 * Toutes les lectures/écritures sont protégées (navigation privée, stockage bloqué).
 */

export type Prefs = {
  universes: string[];
  formats: string[];
  duration: "court" | "moyen" | "long" | "tres-long" | null;
  historyEnabled: boolean;
  autoLoadPlayer: boolean;
};

export type LibraryState = {
  favorites: string[];
  later: string[];
  history: { id: string; at: number }[];
  hidden: string[];
  prefs: Prefs;
  seed: number;
};

export const DEFAULT_PREFS: Prefs = { universes: [], formats: [], duration: null, historyEnabled: true, autoLoadPlayer: false };
const KEY = "vc:library:v1";
const EMPTY: LibraryState = { favorites: [], later: [], history: [], hidden: [], prefs: DEFAULT_PREFS, seed: 1 };

let state: LibraryState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LibraryState>;
      state = sanitize(parsed);
    } else state = { ...EMPTY, seed: Math.floor(Math.random() * 1e6) };
  } catch {
    state = { ...EMPTY, seed: Math.floor(Math.random() * 1e6) };
  }
  window.addEventListener("storage", (e) => {
    if (e.key === KEY && e.newValue) {
      try {
        state = sanitize(JSON.parse(e.newValue));
        listeners.forEach((l) => l());
      } catch {
        /* ignoré */
      }
    }
  });
}

const ID = /^[A-Za-z0-9_-]{11}$/;
export function sanitize(p: Partial<LibraryState>): LibraryState {
  const ids = (a: unknown) => (Array.isArray(a) ? [...new Set(a.filter((x): x is string => typeof x === "string" && ID.test(x)))].slice(0, 500) : []);
  const prefs = { ...DEFAULT_PREFS, ...(p.prefs ?? {}) };
  return {
    favorites: ids(p.favorites),
    later: ids(p.later),
    hidden: ids(p.hidden),
    history: Array.isArray(p.history)
      ? p.history.filter((h): h is { id: string; at: number } => Boolean(h) && typeof h === "object" && ID.test((h as { id: string }).id) && Number.isFinite((h as { at: number }).at)).slice(0, 300)
      : [],
    prefs: {
      universes: Array.isArray(prefs.universes) ? prefs.universes.filter((x) => typeof x === "string").slice(0, 10) : [],
      formats: Array.isArray(prefs.formats) ? prefs.formats.filter((x) => typeof x === "string").slice(0, 12) : [],
      duration: ["court", "moyen", "long", "tres-long"].includes(String(prefs.duration)) ? prefs.duration : null,
      historyEnabled: prefs.historyEnabled !== false,
      autoLoadPlayer: prefs.autoLoadPlayer === true,
    },
    seed: Number.isFinite(p.seed) ? Number(p.seed) : 1,
  };
}

function save(next: LibraryState) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* stockage indisponible : l'état reste en mémoire pour la session */
  }
  listeners.forEach((l) => l());
}

export const library = {
  get: () => {
    load();
    return state;
  },
  subscribe: (l: () => void) => {
    load();
    listeners.add(l);
    return () => listeners.delete(l);
  },
  toggle(list: "favorites" | "later" | "hidden", id: string): boolean {
    const s = library.get();
    const has = s[list].includes(id);
    save({ ...s, [list]: has ? s[list].filter((x) => x !== id) : [id, ...s[list]] });
    return !has;
  },
  remove(list: "favorites" | "later" | "hidden", id: string) {
    const s = library.get();
    save({ ...s, [list]: s[list].filter((x) => x !== id) });
  },
  addHistory(id: string) {
    const s = library.get();
    if (!s.prefs.historyEnabled) return;
    save({ ...s, history: [{ id, at: Date.now() }, ...s.history.filter((h) => h.id !== id)].slice(0, 300) });
  },
  removeHistory(id: string) {
    const s = library.get();
    save({ ...s, history: s.history.filter((h) => h.id !== id) });
  },
  clearHistory() {
    save({ ...library.get(), history: [] });
  },
  setPrefs(p: Partial<Prefs>) {
    const s = library.get();
    save({ ...s, prefs: { ...s.prefs, ...p } });
  },
  resetRecommendations() {
    const s = library.get();
    save({ ...s, hidden: [], history: [], seed: Math.floor(Math.random() * 1e6) });
  },
  reseed() {
    const s = library.get();
    save({ ...s, seed: Math.floor(Math.random() * 1e6) });
  },
  exportJson(): string {
    return JSON.stringify({ format: "gearmuse-library", version: 1, exportedAt: new Date().toISOString(), data: library.get() }, null, 2);
  },
  importJson(text: string) {
    const parsed = JSON.parse(text) as { format?: string; data?: Partial<LibraryState> };
    // « vehicult-library » : exports réalisés avant l'adoption du nom GearMuse.
    if (!parsed.data || (parsed.format !== "gearmuse-library" && parsed.format !== "vehicult-library")) throw new Error("format");
    save(sanitize(parsed.data));
  },
};

const serverSnapshot = () => EMPTY;
export function useLibrary(): LibraryState {
  return useSyncExternalStore(library.subscribe, library.get, serverSnapshot);
}

/* Notifications légères (toasts) */
export function toast(message: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("vc:toast", { detail: message }));
}

/* Cookies d'interface (thème, langue, langue des vidéos) lisibles par le serveur pour un rendu sans clignotement. null : supprime le cookie. */
export function setUiCookie(name: "theme" | "lang" | "video_lang", value: string | null) {
  document.cookie = `${name}=${encodeURIComponent(value ?? "")}; path=/; max-age=${value === null ? 0 : 60 * 60 * 24 * 365}; samesite=lax`;
}
