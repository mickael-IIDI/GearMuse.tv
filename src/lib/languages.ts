/**
 * Langue des vidéos : préférence du visiteur, enregistrée dans un cookie pour que le serveur
 * rende directement les listes filtrées. Partagé entre le serveur et le client.
 */

export const VIDEO_LANGUAGE_COOKIE = "video_lang";

/** Code de langue tel que stocké en base (ISO 639, en minuscules). */
export function isLanguageCode(value: unknown): value is string {
  return typeof value === "string" && /^[a-z]{2,3}$/.test(value);
}

/** Nom affichable d'une langue, dans la langue de l'interface (« Japonais », « Japanese »). */
export function languageLabel(code: string, locale: string): string {
  // « zxx » : code utilisé par YouTube pour une vidéo sans contenu linguistique.
  if (code === "zxx") return locale === "en" ? "No spoken language" : "Sans paroles";
  try {
    const name = new Intl.DisplayNames([locale], { type: "language" }).of(code);
    if (name && name !== code) return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  } catch {
    // Code inconnu d'Intl : repli sur le code lui-même.
  }
  return code.toUpperCase();
}

export type LanguageOption = { code: string; label: string; count: number };

/**
 * Options du sélecteur : la langue de l'interface d'abord, puis les plus fournies.
 * La langue active reste proposée même si plus aucune vidéo publiée ne l'utilise.
 */
export function buildLanguageOptions(languages: { code: string; count: number }[], locale: string, current?: string | null): LanguageOption[] {
  const all = current && !languages.some((l) => l.code === current) ? [...languages, { code: current, count: 0 }] : languages;
  return all
    .map((l) => ({ ...l, label: languageLabel(l.code, locale) }))
    .sort((a, b) => Number(b.code === locale) - Number(a.code === locale) || b.count - a.count || a.label.localeCompare(b.label, locale));
}
