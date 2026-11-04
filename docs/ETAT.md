# État du projet — 5 novembre 2026

## Catalogue réel constitué (base locale PGlite, aucune donnée inventée)

| Indicateur | Valeur |
|---|---|
| Stories Hacker News examinées (2007-2026, ≥ 5 points, liant YouTube) | 16 457 |
| Vidéos candidates enregistrées | 1 343 |
| Vérifiées via oEmbed (existence, intégrabilité) | 1 246 |
| **Publiées automatiquement** (note ≥ 55, confiance ≥ 0,4, pertinence ≥ 0,55) | **206** |
| En file de validation humaine | 562 |
| Rejetées (hors périmètre ou insuffisantes) | 480 |
| Indisponibles chez YouTube (supprimées / privées) | 57 |
| Découvertes sans métadonnées (intégration désactivée, titre inaccessible sans clé API) | 38 |
| Chaînes spécialisées vérifiées (Wikidata + flux RSS) | 27 sur 46 proposées |
| Playlists visibles (≥ 3 vidéos publiées) | 5 sur 11 |
| Marques avec au moins une vidéo publiée | 22 |
| URL dans le sitemap | 272 |

Répartition des vidéos publiées : autres véhicules (dont espace) 120, aviation 43, automobile 35, bateaux 6, moto 2.
Ce déséquilibre reflète les sources actuellement accessibles sans clé (Hacker News privilégie l'aéronautique, l'espace
et l'ingénierie). Il se corrige en (1) validant la file de modération, (2) ajoutant la clé YouTube (catalogue complet des
chaînes suivies via `discover_channels {"backfillPages":4}`, descriptions et durées qui renforcent la classification),
(3) configurant Reddit (r/motorcycles, r/boating…).

Les 3 signalements visibles dans l'administration locale proviennent des tests automatisés.

## Fonctionnalités

| Domaine | Statut | Tests |
|---|---|---|
| Interface : accueil à 10 sections, menu latéral complet, thème sombre/clair/système, FR/EN | Terminé | E2E |
| Cartes vidéo (miniature officielle, durée si connue, chaîne, date, univers, sélection, pépite, note, langue, favori, plus tard) | Terminé | E2E |
| Pages univers, sous-catégories, thèmes, technologies, marques, modèles, chaînes, catégories, longues, découvertes, mieux notées | Terminé | E2E + contrôle HTTP de toutes les routes |
| Filtres combinables dans l'URL (date, durée, format, technologie, langue, sélection) et 9 tris | Terminé | Unitaires + E2E |
| Recherche plein texte FR/EN, synonymes, expressions, correction orthographique, élargissement si aucun résultat exact, autocomplétion | Terminé | Unitaires + E2E |
| Page vidéo : lecteur officiel au clic, repli si intégration désactivée, indisponible ou erreur de lecture, justification, preuves, détail de la note, similaires, même marque/modèle, partage, JSON-LD | Terminé | E2E (lecture vérifiée manuellement dans le navigateur) |
| Bibliothèque sans compte : favoris, historique (pause, effacement), à regarder plus tard, masquer, export/import | Terminé | Unitaires + E2E |
| « Pour vous » : profil local, similarité, qualité, diversité, exploration, démarrage à froid, raisons affichées | Terminé | E2E |
| Playlists intelligentes (11 règles) et éditoriales, ordre, notes, SEO | Terminé | E2E |
| Pipeline : découverte HN/chaînes/Reddit/import/propositions, normalisation, enrichissement, vérification, analyse, notation, publication, modération, actualisation | Terminé | Exécuté de bout en bout sur données réelles |
| Notation explicable, seuils et pondérations configurables, provenance des analyses | Terminé | Unitaires |
| Analyse par modèle de langage (Anthropic, sortie JSON contrainte, budget, journal des coûts) | Code terminé, **non exécuté** (pas de clé) | — |
| YouTube Data API (vidéos, chaînes, catalogue des chaînes, quotas) | Code terminé, **non exécuté** (pas de clé) | — |
| Reddit OAuth | Code terminé, **non exécuté** (pas d'identifiants) | — |
| Back-office : tableau de bord, vidéos, fiche (édition, réanalyse, verrou), modération groupée, propositions, signalements, import unitaire et groupé, playlists, taxonomie, sources, tâches, analyses IA et coûts, réglages, journal d'audit, comptes et rôles | Terminé | E2E + tâches lancées depuis l'interface |
| Sécurité : scrypt, sessions hachées, verrouillage, rôles, limitation de débit, CSP, validation zod, audit | Terminé | E2E (accès refusé, mauvais mot de passe) |
| SEO : rendu serveur, titres, descriptions, canonical, sitemap, robots, VideoObject (si date connue), BreadcrumbList, ItemList, noindex des pages pauvres | Terminé | E2E |
| Pages légales : à propos/méthode, confidentialité, mentions légales, contact, signalement, proposition | Terminé (champs éditeur à compléter) | Contrôle HTTP |
| Build de production, lint, types | OK (0 avertissement ESLint, TypeScript strict) | CI |
| CI GitHub Actions, ingestion planifiée, crons Vercel | Fichiers prêts, **non exécutés** (pas de dépôt distant) | — |

## Limites connues et travaux restants

1. **Clé YouTube Data API absente** : pas de durée (filtres de durée et « Vidéos longues » vides), pas de date de publication pour les vidéos issues de Hacker News, peu de vues connues (pépites rares), confiance des notes plafonnée. Priorité n°1.
2. **Validation éditoriale** : 562 vidéos attendent un humain ; c'est voulu (cas incertains), mais elle conditionne l'équilibre entre univers.
3. **Classifieur à règles** : précis sur les titres explicites, plus faible sur les titres allusifs ; l'analyse IA (clé Anthropic) et les descriptions (clé YouTube) l'améliorent. Les résumés éditoriaux n'existent qu'avec l'IA ou la rédaction.
4. **Recherche** lexicale uniquement (pas d'embeddings) ; à mesurer avant d'ajouter pgvector.
5. **Limiteur de débit en mémoire** (par instance) : compléter par le pare-feu de l'hébergeur.
6. **Purge à 12 mois** des propositions et signalements traités : à ajouter en tâche planifiée.
7. **Internationalisation** : interface FR/EN par cookie ; pas encore d'URL préfixées par langue pour le référencement anglais.
8. **Images de playlists** : mosaïque des miniatures officielles (pas de visuel dédié).
9. **npm audit** : 0 vulnérabilité dans les dépendances de production ; alertes modérées uniquement dans l'outillage de développement (esbuild via drizzle-kit, minimatch via typescript-eslint), à suivre lors des mises à jour.
