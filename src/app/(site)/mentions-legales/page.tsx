import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Mentions légales", alternates: { canonical: "/mentions-legales" } };

export default function LegalPage() {
  const missing = <span className="rounded bg-accent-soft px-1.5 text-accent">à compléter (variables d&apos;environnement)</span>;
  return (
    <div className="max-w-3xl">
      <PageHeader title="Mentions légales" />
      <div className="prose-text text-[15px] leading-7 text-fg/90">
        <h2>Éditeur</h2>
        <p>
          Site : {siteConfig.name} — <a href={siteConfig.url}>{siteConfig.domain}</a>
          <br />
          Éditeur : {siteConfig.publisher || missing}
          <br />
          Contact : {siteConfig.contactEmail || missing}
          <br />
          Directeur de la publication : {process.env.NEXT_PUBLIC_PUBLICATION_DIRECTOR || missing}
        </p>
        <h2>Hébergement</h2>
        <p>{process.env.NEXT_PUBLIC_HOSTING_PROVIDER || missing}</p>
        <h2>Contenus</h2>
        <p>
          Les vidéos présentées sont hébergées par YouTube et restent la propriété de leurs auteurs. Elles sont intégrées au moyen du lecteur officiel, conformément aux conditions de YouTube.
          Les titres, descriptions et miniatures proviennent de YouTube. Les résumés, classements et notes sont produits par {siteConfig.name}.
        </p>
        <p>Les extraits de discussions publiques (Hacker News) sont courts, attribués à leur auteur et accompagnés d&apos;un lien vers la source.</p>
        <h2>Retrait</h2>
        <p>Tout ayant droit peut demander le retrait d&apos;une vidéo ou la correction d&apos;une information via la page « Signaler un contenu ». Les demandes sont traitées dans les meilleurs délais.</p>
        <h2>Marques</h2>
        <p>Les noms de marques et de modèles cités le sont à titre descriptif ; ils appartiennent à leurs propriétaires respectifs.</p>
      </div>
    </div>
  );
}
