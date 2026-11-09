# État du projet — 9 novembre 2026

**Nom et domaine** : GearMuse, `https://gearmuse.tv` (domaine acheté par le propriétaire le 6 novembre 2026). Symbole, favicon,
icônes d'application, image de partage et kit de marque générés ([MARQUE.md](MARQUE.md)) ; URL canonique de production,
redirection www → apex et non-indexation des adresses secondaires en place. **Site non encore déployé** : reliez le domaine
au projet Vercel selon [DEPLOIEMENT.md](DEPLOIEMENT.md) (section 3 bis).

## Catalogue réel constitué (base locale PGlite, aucune donnée inventée)

| Indicateur | Valeur |
|---|---|
| Stories Hacker News examinées (2007-2026, ≥ 5 points, liant YouTube) | 16 457 |
| Chaînes suivies, vérifiées par RSS et actives | 291 : 27 via Wikidata, 29 moto/nautisme résolues par handle (`VERIFIED_CHANNELS`), 235 francophones (`FRENCH_CHANNELS`) ; « Airbus - Topic », « NASA Marathon » et « La French Drive » exclues (`EXCLUDED_CHANNEL_IDS`) |
| Vidéos candidates enregistrées (Hacker News + catalogues des chaînes suivies) | 27 284 |
| Enrichies via la YouTube Data API (titre, description, mots-clés, durée, date, vues, langue, intégrabilité) | 27 195 |
| **Publiées** | **5 681**, dont **3 888 en français** et 1 703 en anglais ; toutes avec durée, date et vues |
| En file de validation humaine | 7 694, dont 6 555 en français (les meilleures vidéos de chaque chaîne ont déjà été examinées) |
| Rejetées (hors périmètre, insuffisantes, Shorts, directs, revue) | 13 820 |
| Indisponibles chez YouTube (supprimées / privées) | 89 |
| Vidéos en français publiées | 3 888, issues de 229 chaînes (40 au plus par chaîne) |
| Pépites (recommandées, moins de 100 000 vues) | 60 |
| Vidéos de plus d'une heure publiées | 241 |
| Playlists visibles (≥ 3 vidéos publiées) | 11 sur 11 |
| Marques avec au moins une vidéo publiée | 113 |
| URL dans le sitemap | 6 005 |
| Consommation API YouTube du 9 novembre | 6 812 unités, 0 erreur (quota gratuit : 10 000 / jour) |

Répartition des vidéos publiées (une vidéo peut relever de plusieurs univers) : automobile 2 606, moto 1 303, bateaux 870,
autres véhicules (dont espace) 670, aviation 566.

### Vidéos francophones (9 novembre 2026)

À la demande du propriétaire (au moins deux fois plus de vidéos en français que de vidéos en anglais), 235 chaînes francophones
ont été retenues parmi 433 candidates trouvées par l'API YouTube (`npm run channels:find`, 40 recherches thématiques), d'après
leur nom et leur présentation. Pour chacune, les 60 vidéos les plus vues parmi les 300 dernières (hors Shorts et directs) ont été
importées, soit 14 224 candidates. Comme la note accorde 18 % aux recommandations indépendantes, quasi absentes pour ces vidéos,
peu dépassent le seuil de publication automatique : les 25 mieux classées de chaque chaîne (5 480) ont donc été revues par sept
agents (Claude Sonnet) selon [REVUE-EDITORIALE.md](REVUE-EDITORIALE.md) : 3 647 approuvées, 1 765 rejetées, 68 en attente.
Un échantillon aléatoire de 100 décisions a été relu (environ une sur quinze discutable). Provenance enregistrée : « Revue assistée
(Claude Code, 2026-11-09, demandée par le propriétaire) ». La décision repose sur les titres, sans visionnage.

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
| Filtres combinables dans l'URL (date, durée, format, technologie, sélection) et 9 tris | Terminé, alimentés par les métadonnées API | Unitaires + E2E |
| Langue des vidéos : sélecteur sur l'accueil, les listes, la recherche, les playlists, la bibliothèque, « Pour vous » et la page vidéo, réglage dans les paramètres ; langues réelles du catalogue avec leur nombre de vidéos ; préférence en cookie, sans compte | Terminé | Unitaires + E2E |
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

1. **Aviation (566) reste l'univers le moins fourni** ; Reddit (r/aviation, r/flying) ou de nouvelles chaînes aéronautiques compléteraient la couverture.
2. **Revues assistées à confirmer** : les 4 990 approbations et 6 378 rejets des revues du 6 et du 9 novembre reposent sur les titres (pas de visionnage) ; 5 à 7 % de décisions discutables. Les 106 doutes et les vidéos en réserve restent à trancher par un humain. La langue vient de YouTube ou, à défaut, de la chaîne, et peut être erronée. Les relecteurs ont parfois appliqué un code par défaut à des séries homogènes (lives, matériel, vlogs).
3. **Classifieur à règles** : précis sur les titres explicites. Un titre qui ne cite aucun véhicule voit sa pertinence réduite et part en validation. Quelques sujets d'entreprise passent encore (ex. interviews d'Elon Musk via Tesla) ; l'analyse IA (clé Anthropic) les écarterait. Les résumés éditoriaux n'existent qu'avec l'IA ou la rédaction.
4. **Base locale PGlite sous Windows** : erreurs d'entrée/sortie intermittentes (« could not open file … Invalid argument ») observées sous forte charge avec ~7 000 vidéos ; relancer l'étape suffit, aucune donnée perdue. En exploitation, utiliser PostgreSQL (Neon).
5. **Recherche** lexicale uniquement (pas d'embeddings) ; à mesurer avant d'ajouter pgvector.
6. **Limiteur de débit en mémoire** (par instance) : compléter par le pare-feu de l'hébergeur.
7. **Purge à 12 mois** des propositions et signalements traités : à ajouter en tâche planifiée.
8. **Internationalisation** : interface FR/EN par cookie ; pas encore d'URL préfixées par langue pour le référencement anglais. Depuis le 9 novembre, le français est majoritaire dans le catalogue, l'automobile concentrant plus de la moitié de ces vidéos ; aviation et nautisme restent à renforcer. La langue provient de la métadonnée déclarée par l'auteur quand elle existe et peut être erronée.
9. **Images de playlists** : mosaïque des miniatures officielles (pas de visuel dédié).
10. **npm audit** : 0 vulnérabilité dans les dépendances de production ; alertes modérées uniquement dans l'outillage de développement (esbuild via drizzle-kit, minimatch via typescript-eslint).
