# État du projet — 6 novembre 2026

## Catalogue réel constitué (base locale PGlite, aucune donnée inventée)

| Indicateur | Valeur |
|---|---|
| Stories Hacker News examinées (2007-2026, ≥ 5 points, liant YouTube) | 16 457 |
| Chaînes suivies, vérifiées par RSS et actives | 56 : 27 via Wikidata + 29 moto/nautisme résolues par handle via l'API YouTube (`VERIFIED_CHANNELS`) ; « Airbus - Topic » et « NASA Marathon » (identifiants Wikidata erronés) exclues (`EXCLUDED_CHANNEL_IDS`) |
| Vidéos candidates enregistrées (Hacker News + catalogues des chaînes suivies) | 13 060 |
| Enrichies via la YouTube Data API (titre, description, mots-clés, durée, date, vues, langue, intégrabilité) | 12 971 |
| **Publiées** | **1 862** — 519 par publication automatique + 1 343 approuvées en revue assistée ; toutes avec durée, date et vues |
| En file de validation humaine | 677 (639 en réserve au titre du plafond de 40 par chaîne, 38 doutes à trancher) |
| Rejetées (hors périmètre, insuffisantes, Shorts, directs, revue) | 10 432 |
| Indisponibles chez YouTube (supprimées / privées) | 89 |
| Vidéos en français publiées | 81 |
| Pépites (recommandées, moins de 100 000 vues) | 60 |
| Vidéos de plus d'une heure publiées | 129 |
| Playlists visibles (≥ 3 vidéos publiées) | 11 sur 11 |
| Marques avec au moins une vidéo publiée | 97 |
| URL dans le sitemap | 2 118 |
| Consommation API YouTube du 5 novembre | 672 unités, 0 erreur (quota gratuit : 10 000 / jour) |

Répartition des vidéos publiées (univers principal) : bateaux 483, automobile 425, moto 424, autres véhicules
(dont espace) 329, aviation 201.

### Revue de la file de validation (6 novembre 2026)

À la demande du propriétaire, les 6 633 vidéos en attente ont été revues selon la grille
[REVUE-EDITORIALE.md](REVUE-EDITORIALE.md) par huit agents relecteurs (Claude Sonnet), chaque chaîne étant confiée
entière à un même relecteur (plafond de 40 vidéos publiées par chaîne). Les fichiers de décisions ont été contrôlés
(6 633 décisions valides, aucune manquante ni en double), puis un échantillon aléatoire de 80 décisions a été relu.
Environ une décision sur vingt est discutable, presque toujours par excès de sévérité (ex. un essai rejeté comme actualité).

| Décision | Nombre | Principaux motifs |
|---|---|---|
| Approuvées | 1 343 | essai 382, explication 313, atelier/restauration 212, documentaire 195, reportage 89, pilotage 67, voyage 56, compétition 29 |
| Rejetées | 4 613 | valeur faible 1 340, actualité éphémère 1 219, vlog 637, promotion 466, hors sujet 464, équipement 300, doublon 187 |
| En attente | 677 | réserve de diversité 639, doute 38 |

Chaque décision est enregistrée avec sa provenance (« Revue assistée (Claude Code, 2026-11-06, demandée par le
propriétaire) » et son code) dans `editorial_reviews`, et résumée dans le journal d'audit. Elle n'est **pas** présentée
comme une validation humaine : le badge public « Sélection de la rédaction » n'est attribué qu'à la main. Chaque décision
est réversible depuis l'administration (fiche vidéo : « Rendre au pipeline »). Pour une revue suivante :
`npm run review:apply -- --dry-run` puis `npm run review:apply -- --label "…"`.

Pour la sélection automatique : une vidéo issue des seules chaînes (sans recommandation communautaire) est publiée
si sa note atteint le seuil, dans la limite de 25 par chaîne ; la revue éditoriale peut aller jusqu'à 40.
Les 3 signalements visibles dans l'administration locale proviennent des tests automatisés.

## Fonctionnalités

| Domaine | Statut | Tests |
|---|---|---|
| Interface : accueil à 10 sections, menu latéral complet, thème sombre/clair/système, FR/EN | Terminé | E2E |
| Cartes vidéo (miniature officielle, durée, chaîne, vues, date, univers, sélection, pépite, note, langue, favori, plus tard) | Terminé | E2E |
| Pages univers, sous-catégories, thèmes, technologies, marques, modèles, chaînes, catégories, longues, découvertes, mieux notées | Terminé | E2E + contrôle HTTP de toutes les routes |
| Filtres combinables dans l'URL (date, durée, format, technologie, langue, sélection) et 9 tris | Terminé, alimentés par les métadonnées API | Unitaires + E2E |
| Recherche plein texte FR/EN, synonymes, expressions, correction orthographique (1 faute ≤ 6 lettres, 2 au-delà), élargissement, autocomplétion | Terminé | Unitaires + E2E |
| Page vidéo : lecteur officiel au clic, repli si intégration désactivée, indisponible ou erreur de lecture, justification, preuves, détail de la note, similaires, même marque/modèle, partage, JSON-LD VideoObject | Terminé | E2E (lecture vérifiée manuellement dans le navigateur) |
| Bibliothèque sans compte : favoris, historique (pause, effacement), à regarder plus tard, masquer, export/import | Terminé | Unitaires + E2E |
| « Pour vous » : profil local, similarité, qualité, diversité, exploration, démarrage à froid, raisons affichées | Terminé | E2E |
| Playlists intelligentes (11 règles) et éditoriales, ordre, notes, SEO | Terminé | E2E |
| Pipeline : découverte HN/chaînes/Reddit/import/propositions, normalisation, enrichissement, vérification, analyse, notation, publication, modération, actualisation | Terminé | Exécuté de bout en bout sur données réelles |
| YouTube Data API : vidéos, chaînes, catalogue des chaînes (`backfillPages`, `pagesByUniverse`), quotas, Shorts, directs | Terminé et exécuté | Unitaires + exécution réelle |
| Notation explicable, seuils et pondérations configurables, provenance des analyses | Terminé | Unitaires |
| Analyse par modèle de langage (Anthropic, sortie JSON contrainte, budget, journal des coûts) | Code terminé, **non exécuté** (pas de clé) | — |
| Reddit OAuth | Code terminé, **non exécuté** (pas d'identifiants) | — |
| Back-office : tableau de bord, vidéos, fiche (édition, réanalyse, verrou), modération groupée, propositions, signalements, import unitaire et groupé, playlists, taxonomie, sources, tâches, analyses IA et coûts, réglages, journal d'audit, comptes et rôles | Terminé | E2E + tâches lancées depuis l'interface |
| Sécurité : scrypt, sessions hachées, verrouillage, rôles, limitation de débit, CSP, validation zod, audit | Terminé | E2E (accès refusé, mauvais mot de passe) |
| SEO : rendu serveur, titres, descriptions, canonical, sitemap, robots, VideoObject, BreadcrumbList, ItemList, noindex des pages pauvres | Terminé | E2E |
| Pages légales : à propos/méthode, confidentialité, mentions légales, contact, signalement, proposition | Terminé (champs éditeur à compléter) | Contrôle HTTP |
| Build de production, lint, types | OK (0 avertissement ESLint, TypeScript strict) | CI |
| CI GitHub Actions, ingestion planifiée, crons Vercel | Fichiers prêts, **non exécutés** (pas de dépôt distant) | — |

## Limites connues et travaux restants

1. **Aviation (201) désormais l'univers le moins fourni** ; Reddit (r/aviation, r/flying) ou de nouvelles chaînes aéronautiques compléteraient la couverture.
2. **Revue assistée à confirmer** : 1 343 approbations et 4 613 rejets reposent sur les titres (pas de visionnage) ; environ 5 % de décisions discutables, surtout des rejets sévères. 38 doutes et 639 vidéos en réserve restent à trancher par un humain. Les relecteurs ont parfois appliqué un code par défaut à des séries homogènes (lives, matériel, vlogs).
3. **Classifieur à règles** : précis sur les titres explicites. Un titre qui ne cite aucun véhicule voit sa pertinence réduite et part en validation. Quelques sujets d'entreprise passent encore (ex. interviews d'Elon Musk via Tesla) ; l'analyse IA (clé Anthropic) les écarterait. Les résumés éditoriaux n'existent qu'avec l'IA ou la rédaction.
4. **Base locale PGlite sous Windows** : erreurs d'entrée/sortie intermittentes (« could not open file … Invalid argument ») observées sous forte charge avec ~7 000 vidéos ; relancer l'étape suffit, aucune donnée perdue. En exploitation, utiliser PostgreSQL (Neon).
5. **Recherche** lexicale uniquement (pas d'embeddings) ; à mesurer avant d'ajouter pgvector.
6. **Limiteur de débit en mémoire** (par instance) : compléter par le pare-feu de l'hébergeur.
7. **Purge à 12 mois** des propositions et signalements traités : à ajouter en tâche planifiée.
8. **Internationalisation** : interface FR/EN par cookie ; pas encore d'URL préfixées par langue pour le référencement anglais. 81 vidéos en français publiées (Le Repaire des Motards, Vilebrequin) : sources francophones à renforcer (aviation, nautisme). La langue provient de la métadonnée déclarée par l'auteur quand elle existe et peut être erronée.
9. **Images de playlists** : mosaïque des miniatures officielles (pas de visuel dédié).
10. **npm audit** : 0 vulnérabilité dans les dépendances de production ; alertes modérées uniquement dans l'outillage de développement (esbuild via drizzle-kit, minimatch via typescript-eslint).
