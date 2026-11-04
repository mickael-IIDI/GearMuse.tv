import { cookies } from "next/headers";
import type { Locale } from "@/config/site";
import { getDictionary } from "@/lib/i18n";

export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get("lang")?.value;
  return c === "en" ? "en" : "fr";
}

export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: getDictionary(locale) };
}

export async function getTheme(): Promise<"dark" | "light" | "system"> {
  const c = (await cookies()).get("theme")?.value;
  return c === "light" || c === "system" ? c : "dark";
}
