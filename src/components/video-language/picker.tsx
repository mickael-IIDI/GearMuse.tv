"use client";

import { IconChevron, IconGlobe } from "@/components/icons";
import { useI18n } from "@/components/locale-provider";
import { useVideoLanguage } from "./provider";

/**
 * Sélecteur de la langue des vidéos, mis en avant à côté des listes.
 * La liste native, transparente, recouvre toute la pastille : un clic n'importe où l'ouvre.
 * Elle reste accessible au clavier, adaptée au mobile et jamais tronquée par un conteneur.
 */
export function LanguagePicker({ size = "md" }: { size?: "md" | "lg" }) {
  const { t, locale } = useI18n();
  const { current, options, total, pending, setLanguage } = useVideoLanguage();
  const count = (n: number) => n.toLocaleString(locale === "en" ? "en" : "fr-FR");
  const allLabel = `${t.videoLanguage.all} (${count(total)})`;
  const optionLabel = (o: { label: string; count: number }) => `${o.label} (${count(o.count)})`;
  const selected = options.find((o) => o.code === current);
  return (
    <label
      className={`relative inline-flex max-w-full cursor-pointer items-center gap-2 rounded-full border pl-3.5 pr-8 font-medium outline-offset-2 outline-[var(--focus)] transition-colors has-[:focus-visible]:outline-2 ${size === "lg" ? "h-11 text-[15px]" : "h-9 text-sm"} ${
        current ? "border-transparent bg-accent text-accent-ink hover:opacity-90" : "border-accent/70 bg-accent-soft hover:border-accent"
      } ${pending ? "opacity-60" : ""}`}
    >
      <IconGlobe size={size === "lg" ? 19 : 17} className={current ? "shrink-0" : "shrink-0 text-accent"} />
      <span className="hidden whitespace-nowrap sm:inline">{t.videoLanguage.label}</span>
      <span className="truncate font-semibold">{selected ? optionLabel(selected) : allLabel}</span>
      <IconChevron size={15} className="pointer-events-none absolute right-3 rotate-90" />
      <select
        aria-label={t.videoLanguage.label}
        value={current ?? ""}
        disabled={pending}
        onChange={(e) => setLanguage(e.target.value || null)}
        className="absolute inset-0 size-full cursor-pointer appearance-none rounded-full opacity-0 [&_option]:bg-elev [&_option]:text-fg"
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.code} value={o.code}>{optionLabel(o)}</option>
        ))}
      </select>
    </label>
  );
}

/** Retour à toutes les langues depuis une liste vidée par le filtre. */
export function LanguageResetButton() {
  const { t } = useI18n();
  const { setLanguage, pending } = useVideoLanguage();
  return (
    <button type="button" disabled={pending} onClick={() => setLanguage(null)} className="mt-3 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60">
      {t.videoLanguage.showAll}
    </button>
  );
}
