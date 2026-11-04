"use client";

import { createContext, useContext } from "react";
import type { Locale } from "@/config/site";
import { getDictionary } from "@/lib/i18n";

const Ctx = createContext<Locale>("fr");

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const locale = useContext(Ctx);
  return { locale, t: getDictionary(locale) };
}
