import { cookies } from "next/headers";
import type { Locale } from "@/config/site";
import { getDictionary } from "@/lib/i18n";
import { isLanguageCode, VIDEO_LANGUAGE_COOKIE } from "@/lib/languages";

export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get("lang")?.value;
  return c === "en" ? "en" : "fr";
}

export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: getDictionary(locale) };
}

/** Langue des vidéos choisie par le visiteur (undefined : toutes les langues). */
export async function getVideoLanguage(): Promise<string | undefined> {
  const c = (await cookies()).get(VIDEO_LANGUAGE_COOKIE)?.value;
  return isLanguageCode(c) ? c : undefined;
}

export async function getTheme(): Promise<"dark" | "light" | "system"> {
  const c = (await cookies()).get("theme")?.value;
  return c === "light" || c === "system" ? c : "dark";
}
