import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { PageHeader } from "@/components/ui/page-header";
import { affiliateEnabled, serverAffiliateEnv } from "@/lib/affiliates";
import { getSetting } from "@/server/settings";
import { catalogCounts } from "@/server/queries/videos";

export const metadata: Metadata = {
  title: "À propos et méthode",
  description: `Comment ${siteConfig.name} sélectionne, classe et note les vidéos sur les véhicules motorisés : sources, critères, transparence.`,
  alternates: { canonical: "/a-propos" },
};

export default async function AboutPage() {
  const [counts, scoring] = await Promise.all([catalogCounts(), getSetting("scoring")]);
  const w = scoring.weights;
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  const pct = (n: number) => `${Math.round((n / total) * 100)} %`;
  return (
    <div className="max-w-3xl">
      <PageHeader title={`À propos de ${siteConfig.name}`} subtitle="Une médiathèque de découverte, pas un site d'actualité : des vidéos choisies pour ce qu'elles apprennent, racontent ou montrent." />
      <div className="prose-text text-[15px] leading-7 text-fg/90">
        <p>
          {siteConfig.name} réunit des vidéos consacrées à tous les véhicules motorisés — automobiles, motos, avions, bateaux, trains, engins, fusées — et à leurs technologies.
          Les vidéos ne sont pas hébergées ici : elles restent sur YouTube, sont lues avec le lecteur officiel et appartiennent à leurs auteurs.
          Notre travail consiste à les <strong>identifier, vérifier, classer, contextualiser et recommander</strong>.
        </p>
        <p>
          État actuel du catalogue : <strong>{counts.published.toLocaleString("fr-FR")}</strong> vidéos publiées, {counts.pending.toLocaleString("fr-FR")} en attente de validation éditoriale,
          {" "}{counts.rejected.toLocaleString("fr-FR")} écartées (hors sujet ou insuffisantes) et {counts.unavailable.toLocaleString("fr-FR")} devenues indisponibles chez YouTube. Ces chiffres sont calculés en direct.
        </p>

        <h2>D&apos;où viennent les vidéos ?</h2>
        <ul>
          <li><strong>Hacker News</strong> (API publique Algolia) : vidéos soumises et votées par la communauté, et vidéos citées dans les discussions. Chaque personne distincte qui recommande une vidéo est comptée une seule fois.</li>
          <li><strong>Chaînes spécialisées et officielles</strong> : identifiants résolus via Wikidata, puis vérifiés par le flux public de chaque chaîne. Aucune chaîne n&apos;est ajoutée sans vérification.</li>
          <li><strong>Reddit</strong> (API officielle, si configurée), <strong>sélections éditoriales</strong> et <strong>propositions des visiteurs</strong> (<Link href="/proposer">proposer une vidéo</Link>), toujours validées avant publication.</li>
        </ul>
        <p>Nous n&apos;utilisons aucune technique de collecte interdite et ne contournons aucune restriction. Les métadonnées proviennent de l&apos;API officielle de YouTube lorsqu&apos;elle est configurée, sinon de son point d&apos;accès public oEmbed.</p>

        <h2 id="notation">Comment une vidéo est-elle notée ?</h2>
        <p>Chaque vidéo reçoit une <strong>note qualitative interne sur 100</strong>, affichée comme telle. Elle combine des critères pondérés :</p>
        <ul>
          <li>Pertinence thématique ({pct(w.relevance)}), profondeur technique ({pct(w.technicalDepth)}), qualité pédagogique ({pct(w.pedagogy)}), intérêt historique ({pct(w.historicalInterest)}), originalité ({pct(w.originality)}) ;</li>
          <li>Crédibilité de l&apos;auteur ({pct(w.creatorCredibility)}), recommandations indépendantes ({pct(w.independentRecommendations)}), répétition des recommandations dans le temps ({pct(w.recurrence)}) ;</li>
          <li>Valeur durable ({pct(w.durableValue)}), rareté — une vidéo recommandée mais peu vue ({pct(w.rarity)}) — et fraîcheur pour les contenus d&apos;actualité ({pct(w.freshness)}).</li>
        </ul>
        <p>
          Un critère qui ne peut pas être mesuré avec les données disponibles est <strong>exclu du calcul</strong> et fait baisser l&apos;indice de confiance, au lieu d&apos;être deviné.
          Les vues et les abonnés ne servent jamais à gonfler une note ; les titres racoleurs et les formats très courts sont pénalisés.
          Le détail complet de la note, critère par critère, est consultable sur chaque page vidéo.
        </p>
        <p>
          Les vidéos dont la note atteint {scoring.thresholds.publish} avec une confiance suffisante sont publiées automatiquement. Les cas incertains (note à partir de {scoring.thresholds.review}) sont placés dans une file de validation humaine.
          Pour préserver la diversité, une même chaîne ne peut avoir plus de {scoring.thresholds.maxAutoPublishPerChannel} vidéos publiées automatiquement sans recommandation indépendante.
          Nous distinguons toujours une vidéo <em>populaire</em>, une vidéo <em>recommandée par plusieurs sources indépendantes</em>, une vidéo <em>validée par la rédaction</em> (badge « Sélection ») et une vidéo <em>détectée automatiquement</em>.
        </p>

        <h2>Classification et résumés</h2>
        <p>
          La classification (univers, sous-catégories, marques, modèles, thèmes, formats) est réalisée par un classifieur à règles transparent et, lorsqu&apos;il est activé, par un modèle de langage.
          Chaque analyse est conservée avec sa provenance, la version du modèle et les signaux observés. Un résumé généré automatiquement est toujours signalé comme tel.
          Nous n&apos;inventons ni recommandation, ni source, ni validation.
        </p>

        <h2>Recommandations sans compte</h2>
        <p>
          Les favoris, l&apos;historique et vos préférences sont stockés uniquement dans votre navigateur. Pour calculer la page « Pour vous », votre navigateur envoie ponctuellement une liste d&apos;identifiants de vidéos ; elle n&apos;est ni conservée ni associée à une identité.
          Chaque recommandation est expliquée (« Recommandée car vous aimez… », « Une découverte dans l&apos;univers… »).
        </p>

        <h2>Miniatures</h2>
        <p>
          Nous affichons les miniatures officielles fournies par YouTube, sans modification. Nous n&apos;extrayons aucune image des vidéos : cela supposerait de télécharger les contenus, ce que les conditions de YouTube interdisent.
        </p>

        {affiliateEnabled(serverAffiliateEnv()) && (
          <>
            <h2 id="affiliation">Liens affiliés</h2>
            <p>
              Certaines pages (marques, modèles, vidéos) proposent des liens vers des marchands, signalés par la mention « Liens affiliés ». Si vous achetez après avoir suivi l&apos;un d&apos;eux, {siteConfig.name} peut percevoir une commission, sans surcoût pour vous.
              Ces liens sont générés automatiquement à partir du nom de la marque ou du modèle : ils ne sont pas des recommandations de produits, et ils n&apos;ont <strong>aucune influence sur la sélection, le classement ou la note des vidéos</strong>.
              Aucun traceur n&apos;est chargé sur ce site ; le suivi commence chez le marchand, après votre clic.
            </p>
          </>
        )}

        <h2>Inspiration</h2>
        <p>
          L&apos;ergonomie s&apos;inspire de HackerTube, la médiathèque créée par Andrej Karpathy à partir des recommandations de Hacker News. {siteConfig.name} est un projet indépendant, sans lien avec HackerTube, YouTube ou Hacker News.
        </p>
        <p>
          Un auteur souhaite retirer une vidéo ou corriger une information ? <Link href="/signaler">Signalez-le ici</Link>.
        </p>
      </div>
    </div>
  );
}
