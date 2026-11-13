import Link from "next/link";
import { siteConfig } from "@/config/site";
import { IconExternal } from "@/components/icons";
import { affiliateLinks, serverAffiliateEnv, type AffiliateSubject } from "@/lib/affiliates";
import { getI18n } from "@/server/locale";

/**
 * Bloc de liens affiliés pour une marque ou un modèle. Rendu côté serveur, sans script tiers.
 * Ne rend rien tant qu'aucun identifiant de programme n'est configuré.
 * À placer à distance du lecteur vidéo (règles des services d'API YouTube).
 */
export async function AffiliateBlock({ subject, className = "" }: { subject: AffiliateSubject; className?: string }) {
  const links = affiliateLinks(subject, serverAffiliateEnv());
  if (!links.length) return null;
  const { t } = await getI18n();
  return (
    <aside aria-label={t.affiliate.badge} className={`rounded-2xl border border-line p-4 sm:p-5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold">{t.affiliate.title(subject.name)}</h2>
        <span className="rounded bg-soft px-1.5 py-0.5 text-xs text-muted">{t.affiliate.badge}</span>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {links.map((l) => (
          <li key={`${l.program}-${l.kind}`}>
            <a
              href={l.href}
              target="_blank"
              rel="sponsored nofollow noopener"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-soft px-3 text-[13.5px] font-medium hover:bg-hover"
            >
              {t.affiliate.on(t.affiliate.kinds[l.kind], l.merchant)} <IconExternal size={12} />
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-faint">
        {t.affiliate.disclosure(siteConfig.name)}
        {links.some((l) => l.program === "amazon") && <> {t.affiliate.amazon(siteConfig.name)}</>}{" "}
        <Link href="/a-propos#affiliation" className="underline hover:text-fg">{t.affiliate.more}</Link>
      </p>
    </aside>
  );
}
