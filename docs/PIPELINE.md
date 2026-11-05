# Pipeline d'ingestion et de curation

Toutes les étapes sont incrémentales, relançables et journalisées (`ingestion_jobs`, `job_events`). Elles se lancent
en ligne de commande (`npm run ingest -- …`), depuis l'administration (« Tâches automatiques ») ou par planification
(`.github/workflows/ingest.yml`, `/api/cron/<tâche>`).

| # | Étape | Tâche | Détail |
|---|---|---|---|
| 1 | Découverte | `discover_hn_stories`, `discover_hn_comments`, `discover_channels`, `discover_reddit`, import manuel, propositions | Chaque mention est enregistrée dans `video_sources`, avec sa preuve dans `recommendation_evidence` |
| 2 | Normalisation | (intégrée) | Extraction de l'identifiant à 11 caractères, déduplication par (fournisseur, identifiant), fusion des mentions |
| 3 | Enrichissement | `enrich` | Avec `YOUTUBE_API_KEY` : `videos.list` (1 unité par lot de 50) puis `channels.list`. Sans clé : oEmbed (titre, chaîne, miniature) |
| 4 | Vérification | `enrich`, `refresh_availability` | oEmbed : 200 disponible, 401/403 intégration désactivée ou privée, 404 supprimée ; API : vidéos absentes = indisponibles |
| 5 | Analyse | `analyze` | Classifieur à règles (par défaut) ou modèle de langage : univers, sous-catégories, thèmes, formats, technologies, marques, modèles, niveau, temporalité, profondeur technique, pédagogie, intérêt historique, langue, résumé (IA) |
| 6 | Évaluation | `score` | Note sur 100 explicable (voir ci-dessous) |
| 7 | Publication | `score` | Seuils : publication automatique si note ≥ `publish`, confiance ≥ `minConfidence` et pertinence ≥ `minRelevance` ; au plus `maxAutoPublishPerChannel` (25) vidéos par chaîne sans recommandation indépendante (les mieux notées), le surplus part en validation |
| 8 | Contrôle | `score` + administration | Note entre `review` et `publish` → file de validation ; en dessous → rejet. Un statut fixé par un éditeur est verrouillé |
| 9 | Actualisation | `refresh_availability`, `discover_hn_mentions` | Revérification au plus tard tous les 25 jours (règles YouTube : 30 jours max.), recherche de nouveaux recommandeurs |

## Sources

- **Hacker News** (API Algolia, publique) : stories dont l'URL pointe vers YouTube (points ≥ 5 par défaut, découpage
  automatique des fenêtres de temps au-delà de 1 000 résultats) ; commentaires citant une vidéo (≥ 2 personnes distinctes
  pour une nouvelle vidéo) ; pour chaque vidéo du périmètre, recherche des commentaires qui la citent (recommandeurs distincts dans le temps).
- **Chaînes spécialisées et officielles** : liste éditoriale (`src/lib/taxonomy/sources.ts`), identifiants résolus via Wikidata (P2397)
  ou, pour `VERIFIED_CHANNELS`, par leur handle via l'API YouTube (`channels.list forHandle`, 1 unité) après contrôle humain du titre
  et de la description ; dans tous les cas **revérifiés** par le flux RSS public de YouTube (titre concordant). Les chaînes non vérifiées
  sont ignorées et journalisées. `discover_channels {"channelIds":[…]}` limite une remontée aux chaînes indiquées.
  Avec la clé API, `discover_channels {"backfillPages":N}` remonte les N×50 dernières vidéos de chaque chaîne, et
  `{"pagesByUniverse":{"moto":10,"nautisme":10}}` cible plus profondément les univers sous-représentés.
  Shorts (≤ 60 s, ou ≤ 3 min avec #shorts ou au moins deux mots-dièses dans le titre) et diffusions en direct
  (en cours, programmées ou de plus de 12 h) sont exclus.
- **Reddit** : API OAuth officielle uniquement (désactivée sans identifiants).
- **Import éditorial** et **propositions des visiteurs** (validées par un éditeur).

Le pré-filtre thématique (sur le titre de la story) évite d'interroger YouTube pour des vidéos manifestement hors sujet.
Limitation de débit par hôte, nouvelles tentatives avec attente exponentielle, respect de `Retry-After`, suivi des quotas (`api_usage`),
réserve de 500 unités YouTube pour les opérations manuelles.

## Notation (pondérations par défaut, modifiables dans l'administration)

| Critère | Poids | Mesure |
|---|---|---|
| Pertinence thématique | 14 | Score du classifieur (0-1) |
| Profondeur technique | 12 | Signaux (« explained », « engineering », vue en coupe, durée longue…) — non mesurable sans signal |
| Qualité pédagogique | 10 | « how it works », « comment fonctionne », tutoriel, cours… — non mesurable sans signal |
| Intérêt historique | 6 | Thème histoire détecté |
| Originalité | 6 | Modèle de langage uniquement |
| Crédibilité de l'auteur | 8 | Niveau de confiance de la chaîne suivie ou officielle |
| Recommandations indépendantes | 18 | max(recommandeurs distincts, votes communautaires), avec bonus pour leur combinaison |
| Répétition dans le temps | 10 | Nombre de mois et d'années distincts de recommandation |
| Valeur durable | 8 | Temporalité (durable / datée / actualité) + recommandée longtemps après publication |
| Rareté | 5 | Peu de vues **et** au moins une recommandation |
| Fraîcheur | 3 | Seulement pour les contenus datés ou d'actualité |

Pénalités : Shorts (−30), moins de 90 s (−15), titre racoleur (−5 par marqueur, 2 max.), intégration désactivée (−3).
**Confiance** = part pondérée des critères mesurables × confiance de classification × complétude des métadonnées.
La **justification de sélection** affichée est construite uniquement à partir des preuves enregistrées (points, personnes, années, chaîne suivie, sélection éditoriale).

## Classifieur à règles

Mots-clés FR/EN normalisés par univers et sous-catégorie (préfixe `!` = fort), champs pondérés (titre ×3, mots-clés de
l'auteur et titres de recommandation ×2, chaîne ×1,5, description ×0,6), marques et modèles (les modèles ambigus
exigent la marque), exclusions des faux positifs (« search engine », « game engine », « race condition », « train a model »,
contextes de jeu vidéo et bandes-annonces, homonymes comme « Guy Kawasaki »). Ni une marque seule ni la thématique
de la chaîne ne suffisent à entrer dans le périmètre : il faut au moins un mot-clé véhicule. Si ni le titre ni les
titres de recommandation ne citent un véhicule (seules la description ou la chaîne le font), la pertinence est réduite
de 40 % : la vidéo part en validation humaine plutôt qu'en publication automatique.
Chaque décision conserve ses signaux.

### Rapprochement des chaînes sans clé API

Sans clé API, oEmbed fournit l'URL publique de la chaîne (souvent `@handle`) mais pas son identifiant. Une chaîne inconnue
de même nom exact qu'une chaîne suivie est rattachée à celle-ci. Avec la clé API, le rattachement se fait par identifiant.
