import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Contact", alternates: { canonical: "/contact" } };

export default function ContactPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="Contact" />
      <div className="prose-text space-y-4 text-[15px] leading-7">
        {siteConfig.contactEmail ? (
          <p>
            Pour toute question : <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
          </p>
        ) : (
          <p className="text-muted">L&apos;adresse de contact n&apos;est pas encore configurée (variable NEXT_PUBLIC_CONTACT_EMAIL).</p>
        )}
        <ul>
          <li><Link href="/proposer">Proposer une vidéo</Link> pour le catalogue ;</li>
          <li><Link href="/signaler">Signaler un contenu</Link> : vidéo indisponible, erreur de classement, demande de retrait d&apos;un ayant droit.</li>
        </ul>
      </div>
    </div>
  );
}
