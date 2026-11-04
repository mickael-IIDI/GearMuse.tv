import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Politique de confidentialité", alternates: { canonical: "/confidentialite" } };

export default function PrivacyPage() {
  const contact = siteConfig.contactEmail;
  return (
    <div className="max-w-3xl">
      <PageHeader title="Politique de confidentialité" subtitle="Dernière mise à jour : novembre 2026." />
      <div className="prose-text text-[15px] leading-7 text-fg/90">
        <h2>Principes</h2>
        <p>{siteConfig.name} fonctionne sans compte utilisateur et sans outil publicitaire ni mesure d&apos;audience tierce. Nous ne vendons ni ne partageons aucune donnée personnelle.</p>

        <h2>Données stockées dans votre navigateur</h2>
        <p>
          Vos favoris, votre historique, votre liste « À regarder plus tard », vos préférences et deux cookies d&apos;interface (thème et langue) sont enregistrés localement sur votre appareil.
          Ils sont strictement nécessaires aux fonctions que vous utilisez et ne nécessitent pas de consentement préalable. Vous pouvez les exporter, les importer ou les effacer depuis les <Link href="/parametres">Paramètres</Link>.
        </p>

        <h2>Recommandations</h2>
        <p>Pour calculer la page « Pour vous », votre navigateur envoie au serveur une liste d&apos;identifiants de vidéos et vos préférences. Ces données sont traitées à la volée pour produire la réponse, puis oubliées : elles ne sont ni enregistrées ni journalisées.</p>

        <h2>Lecteur YouTube</h2>
        <p>
          Les vidéos sont lues avec le lecteur officiel de YouTube en mode « confidentialité renforcée » (youtube-nocookie.com). Le lecteur n&apos;est chargé que lorsque vous lancez la lecture
          (sauf si vous activez le chargement automatique dans les Paramètres). À ce moment, Google peut déposer des cookies et collecter des données selon ses propres règles :{" "}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Règles de confidentialité de Google</a>.
        </p>
        <p>
          Ce site utilise les services d&apos;API de YouTube. En les utilisant, vous acceptez les <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">conditions d&apos;utilisation de YouTube</a>.
          Les miniatures sont chargées depuis les serveurs de YouTube (i.ytimg.com).
        </p>

        <h2>Formulaires</h2>
        <p>
          Lorsque vous proposez une vidéo ou signalez un contenu, nous conservons le message, l&apos;éventuel moyen de contact que vous indiquez et une empreinte non réversible de votre adresse IP (protection contre les abus).
          Ces données servent uniquement à traiter votre demande et sont supprimées au plus tard 12 mois après son traitement.
        </p>

        <h2>Journaux techniques</h2>
        <p>Notre hébergeur peut conserver des journaux techniques (adresse IP, date, page demandée) pendant une durée limitée, pour la sécurité et le bon fonctionnement du service.</p>

        <h2>Vos droits</h2>
        <p>
          Conformément au RGPD, vous disposez de droits d&apos;accès, de rectification, d&apos;effacement, d&apos;opposition et de limitation.
          {contact ? <> Écrivez-nous à <a href={`mailto:${contact}`}>{contact}</a>.</> : " Utilisez la page Contact."} Vous pouvez aussi saisir la CNIL (cnil.fr).
        </p>
      </div>
    </div>
  );
}
