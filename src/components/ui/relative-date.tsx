"use client";

import { useI18n } from "@/components/locale-provider";
import { useNowMinute } from "@/components/use-hydrated";

/** Date relative (« il y a 3 ans ») côté navigateur, date absolue au rendu serveur ; date exacte en infobulle. */
export function RelativeDate({ iso }: { iso: string }) {
  const { locale } = useI18n();
  const nowMinute = useNowMinute();
  const d = new Date(iso);
  const loc = locale === "en" ? "en" : "fr-FR";
  let text = d.toLocaleDateString(loc, { year: "numeric", month: "short" });
  if (nowMinute != null) {
    const diff = (d.getTime() - nowMinute * 60_000) / 1000;
    const rtf = new Intl.RelativeTimeFormat(locale === "en" ? "en" : "fr", { numeric: "auto" });
    const abs = Math.abs(diff);
    text =
      abs < 3600 ? rtf.format(Math.round(diff / 60), "minute")
      : abs < 86400 ? rtf.format(Math.round(diff / 3600), "hour")
      : abs < 86400 * 30 ? rtf.format(Math.round(diff / 86400), "day")
      : abs < 86400 * 365 ? rtf.format(Math.round(diff / (86400 * 30)), "month")
      : rtf.format(Math.round(diff / (86400 * 365)), "year");
  }
  return (
    <time dateTime={iso} title={d.toLocaleDateString(loc, { dateStyle: "long" })} suppressHydrationWarning>
      {text}
    </time>
  );
}
