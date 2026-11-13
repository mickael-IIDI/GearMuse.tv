# Conformité : YouTube, RGPD, droits

## YouTube (Conditions d'utilisation et règles des services d'API)

| Exigence | Mise en œuvre |
|---|---|
| API officielle | YouTube Data API v3 (clé), oEmbed et flux RSS publics officiels. Aucun téléchargement de page de lecture, aucun contournement |
| Lecteur officiel, sans altération | Lecteur IFrame standard (`youtube-nocookie.com`) avec publicités et éléments obligatoires intacts ; aucune surcouche une fois lancé |
| Pas de téléchargement ni de réhébergement | Aucun fichier vidéo n'est récupéré ; seules les métadonnées sont stockées |
| Miniatures | Miniatures **officielles** servies par `i.ytimg.com`, non modifiées, avec lien vers la vidéo |
| Actualisation des données | Revérification au plus tard tous les 25 jours (`refreshAfterDays`, règle des 30 jours) ; vidéos supprimées marquées indisponibles et retirées du site |
| Quotas | Suivi quotidien (`api_usage`), plafond `YOUTUBE_DAILY_QUOTA`, réserve, bascule automatique sur oEmbed en cas de dépassement |
| Politique de confidentialité | Page `/confidentialite` citant les règles de Google et les conditions de YouTube |
| Intégration désactivée | Détectée (oEmbed 401/403, API `embeddable=false`) : la page propose « Regarder sur YouTube » ; erreurs de lecture (codes 100/101/150) gérées côté navigateur |

### Images prises au milieu des vidéos (comme HackerTube)

HackerTube affiche `i.ytimg.com/vi/<id>/hq2.jpg`, une image générée automatiquement par YouTube au milieu de la vidéo.
Analyse :
- ce fichier n'est **pas** une miniature retournée par l'API (`snippet.thumbnails` ne contient que les miniatures choisies
  par l'auteur : default, medium, high, standard, maxres) ; son usage n'est ni documenté ni garanti ;
- les règles des services d'API YouTube demandent d'afficher les données de l'API sans les modifier et de ne pas substituer
  de contenu à celui choisi par l'auteur ;
- générer nos propres captures exigerait de télécharger les vidéos, ce que les conditions interdisent.

**Décision** : miniatures officielles uniquement. L'option pourrait être réétudiée avec un avis juridique ou une autorisation explicite.

## RGPD

- Pas de compte visiteur, pas de traceur publicitaire ni de mesure d'audience tierce : aucun bandeau de consentement requis.
- Préférences et bibliothèque en stockage local, et trois cookies d'interface posés à la demande du visiteur : thème, langue de l'interface, langue des vidéos (fonctionnalités demandées par l'utilisateur, exemptées de consentement).
- Lecteur YouTube chargé uniquement à l'action de l'utilisateur (ou s'il l'a choisi dans les paramètres) ; mention affichée sur la façade.
- Profil de recommandation traité à la volée, ni stocké ni journalisé.
- Formulaires : données minimales, empreinte non réversible de l'adresse IP (anti-abus), conservation limitée (12 mois, à appliquer par une purge planifiée — voir ETAT.md).
- Page confidentialité, mentions légales (champs éditeur à compléter), contact, export / import / effacement des données locales.

## Liens affiliés

Désactivés par défaut : rien ne s'affiche tant que `AFFILIATE_AMAZON_TAG` ou `AFFILIATE_EBAY_CAMPAIGN_ID` n'est pas renseigné (`src/lib/affiliates.ts`).

- **Simples liens de recherche** vers le marchand, construits à partir du nom de la marque ou du modèle. Aucun script, image, widget ni cookie tiers : la politique de sécurité du contenu est inchangée et aucun bandeau de consentement n'est requis. Le suivi commence chez le marchand, après le clic.
- **Liens directs**, sans redirection intermédiaire qui masquerait la destination.
- **Signalés** : mention « Liens affiliés » sur chaque bloc, attribut `rel="sponsored nofollow noopener"`, phrase imposée par Amazon affichée quand un lien Amazon est présent, sections dédiées dans « À propos » et « Confidentialité » (affichées dès qu'un programme est actif).
- **Éloignés du lecteur** : le bloc est placé après la première page de vidéos (marques, modèles) ou sous le panneau éditorial (page vidéo), jamais dans ni contre le lecteur YouTube.
- **Sans effet sur la curation** : le code de sélection et de notation ne lit aucune donnée d'affiliation.
- À vérifier avant l'activation : conditions de chaque programme, et identifiant de rotation eBay (`EBAY_FR_ROTATION`) à comparer avec un lien produit par le générateur d'eBay.

## Droits des créateurs

- Titres, chaînes et liens vers les chaînes affichés ; aucune réutilisation du contenu des vidéos.
- Extraits de commentaires Hacker News courts, attribués et liés à la source.
- Signalement et demande de retrait (`/signaler`) traités dans la file de modération ; exclusion en un clic.
- Valeur éditoriale propre : sélection, classification, justification, notation, playlists, recommandations.
