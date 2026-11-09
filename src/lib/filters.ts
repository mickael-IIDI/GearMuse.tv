/**
 * Filtres et tris du catalogue, conservés dans l'URL (paramètres en français).
 * Partagé entre le serveur (requêtes) et le client (barre de filtres).
 */

import { isLanguageCode } from "./languages";

export const FILTER_GROUPS = {
  date: [
    ["semaine", "Dernière semaine", "Past week"],
    ["mois", "Dernier mois", "Past month"],
    ["annee", "Dernière année", "Past year"],
    ["2020s", "Années 2020", "2020s"],
    ["2010s", "Années 2010", "2010s"],
    ["2000s", "Années 2000", "2000s"],
    ["historique", "Contenus historiques", "Historical content"],
  ],
  duree: [
    ["court", "Moins de 4 minutes", "Under 4 minutes"],
    ["moyen", "4 à 20 minutes", "4–20 minutes"],
    ["long", "20 à 60 minutes", "20–60 minutes"],
    ["tres-long", "Plus d'une heure", "Over an hour"],
  ],
  format: [
    ["essai", "Essai", "Review"],
    ["tutoriel", "Tutoriel", "Tutorial"],
    ["reportage", "Reportage", "Report"],
    ["documentaire", "Documentaire", "Documentary"],
    ["interview", "Interview", "Interview"],
    ["conference", "Conférence", "Talk"],
    ["restauration", "Restauration", "Restoration"],
    ["demonstration", "Démonstration", "Demonstration"],
    ["visite-d-usine", "Visite d'usine", "Factory tour"],
    ["competition", "Compétition", "Racing"],
  ],
  techno: [
    ["thermique", "Thermique", "Combustion"],
    ["electrique", "Électrique", "Electric"],
    ["hybride", "Hybride", "Hybrid"],
    ["hydrogene", "Hydrogène", "Hydrogen"],
    ["vapeur", "Vapeur", "Steam"],
    ["propulsion-speciale", "Propulsion spéciale", "Special propulsion"],
  ],
  qualite: [
    ["pepites", "Pépites méconnues", "Hidden gems"],
    ["incontournables", "Incontournables", "Essentials"],
    ["durables", "Contenus durables", "Evergreen"],
    ["technique", "Forte valeur technique", "Highly technical"],
  ],
} as const;

export const SORTS = [
  ["pertinence", "Pertinence", "Relevance"],
  ["recommandation", "Les plus recommandées", "Most recommended"],
  ["qualite", "Qualité éditoriale", "Editorial quality"],
  ["date", "Date de publication", "Upload date"],
  ["recent", "Ajout au catalogue", "Recently added"],
  ["ancien", "Les plus anciennes", "Oldest first"],
  ["popularite", "Popularité", "Popularity"],
  ["decouverte", "Découverte", "Discovery"],
  ["duree", "Durée", "Duration"],
] as const;

export type FilterKey = keyof typeof FILTER_GROUPS;
export type SortKey = (typeof SORTS)[number][0];

export type VideoFilters = {
  date?: string;
  duree?: string;
  format?: string;
  techno?: string;
  langue?: string;
  qualite?: string;
  univers?: string;
  sous?: string;
  theme?: string;
  marque?: string;
  modele?: string;
  chaine?: number;
};

const SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/;

type SP = Record<string, string | string[] | undefined> | URLSearchParams;
function get(sp: SP, k: string): string | undefined {
  const v = sp instanceof URLSearchParams ? sp.get(k) ?? undefined : sp[k];
  return Array.isArray(v) ? v[0] : v;
}

/** Valide les paramètres d'URL : seules les valeurs connues ou des slugs bien formés sont retenus. */
export function parseFilters(sp: SP): { filters: VideoFilters; sort?: SortKey; page: number; q?: string } {
  const filters: VideoFilters = {};
  for (const key of Object.keys(FILTER_GROUPS) as FilterKey[]) {
    const v = get(sp, key);
    if (v && (FILTER_GROUPS[key] as readonly (readonly string[])[]).some((o) => o[0] === v)) filters[key] = v;
  }
  for (const key of ["univers", "sous", "theme", "marque", "modele"] as const) {
    const v = get(sp, key);
    if (v && SLUG.test(v)) filters[key] = v;
  }
  // La langue vient de la préférence du visiteur (cookie) ; elle ne passe par l'URL que pour le chargement progressif.
  const langue = get(sp, "langue");
  if (isLanguageCode(langue)) filters.langue = langue;
  const ch = Number(get(sp, "chaine"));
  if (Number.isInteger(ch) && ch > 0) filters.chaine = ch;
  const s = get(sp, "tri");
  const sort = SORTS.some((x) => x[0] === s) ? (s as SortKey) : undefined;
  const page = Math.min(200, Math.max(1, Number(get(sp, "page")) || 1));
  const q = get(sp, "q")?.trim().slice(0, 200) || undefined;
  return { filters, sort, page, q };
}

export function filtersToSearchParams(filters: VideoFilters, extra: Record<string, string | number | undefined> = {}): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...filters, ...extra })) if (v !== undefined && v !== "") p.set(k, String(v));
  return p;
}

export function optionLabel(group: FilterKey, value: string, locale: string): string {
  const o = (FILTER_GROUPS[group] as readonly (readonly string[])[]).find((x) => x[0] === value);
  return o ? (locale === "en" ? o[2] : o[1]) : value;
}
