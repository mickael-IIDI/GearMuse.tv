# État du projet — 5 novembre 2026

## Catalogue réel constitué (base locale PGlite, aucune donnée inventée)

| Indicateur | Valeur |
|---|---|
| Stories Hacker News examinées (2007-2026, ≥ 5 points, liant YouTube) | 16 457 |
| Vidéos candidates enregistrées | 1 343 |
| Enrichies via la YouTube Data API (titre, description, mots-clés, durée, date, vues, langue, intégrabilité) | 1 254 |
| **Publiées automatiquement** (note ≥ 55, confiance ≥ 0,4, pertinence ≥ 0,55) | **299** — toutes avec durée, date et vues |
| En file de validation humaine | 631 |
| Rejetées (hors périmètre, insuffisantes, Shorts, directs) | 324 |
| Indisponibles chez YouTube (supprimées / privées) | 89 |
| Pépites (recommandées, moins de 100 000 vues) | 50 |
| Vidéos de plus d'une heure publiées | 34 |
| Chaînes spécialisées vérifiées (Wikidata + flux RSS) | 27 sur 46 proposées |
| Playlists visibles (≥ 3 vidéos publiées) | 9 sur 11 |
| Marques avec au moins une vidéo publiée | 46 |
| URL dans le sitemap | 407 |
| Consommation API YouTube (deux enrichissements complets du catalogue) | 80 unités, 0 erreur (quota gratuit : 10 000 / jour) |

Répartition des vidéos publiées (univers principal) : autres véhicules (dont espace) 150, automobile 79, aviation 55,
bateaux 12, moto 3. Ce déséquilibre reflète Hacker News (aéronautique, espace, ingénierie). Il se corrige en
(1) validant la file de modération, (2) remontant le catalogue complet des chaînes suivies
(`discover_channels {"backfillPages":4}`, désormais possible avec la clé), (3) configurant Reddit (r/motorcycles, r/boating…).

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
| YouTube Data API : vidéos, chaînes, quotas, détection des directs | Terminé et exécuté sur tout le catalogue | Unitaires + appel réel |
| YouTube Data API : remontée du catalogue complet des chaînes suivies (`backfillPages`) | Code terminé, **non exécuté** | — |
| Reddit OAuth | Code terminé, **non exécuté** (pas d'identifiants) | — |
| Back-office : tableau de bord, vidéos, fiche (édition, réanalyse, verrou), modération groupée, propositions, signalements, import unitaire et groupé, playlists, taxonomie, sources, tâches, analyses IA et coûts, réglages, journal d'audit, comptes et rôles | Terminé | E2E + tâches lancées depuis l'interface |
| Sécurité : scrypt, sessions hachées, verrouillage, rôles, limitation de débit, CSP, validation zod, audit | Terminé | E2E (accès refusé, mauvais mot de passe) |
| SEO : rendu serveur, titres, descriptions, canonical, sitemap, robots, VideoObject (si date connue), BreadcrumbList, ItemList, noindex des pages pauvres | Terminé | E2E |
| Pages légales : à propos/méthode, confidentialité, mentions légales, contact, signalement, proposition | Terminé (champs éditeur à compléter) | Contrôle HTTP |
| Build de production, lint, types | OK (0 avertissement ESLint, TypeScript strict) | CI |
| CI GitHub Actions, ingestion planifiée, crons Vercel | Fichiers prêts, **non exécutés** (pas de dépôt distant) | — |

## Limites connues et travaux restants

1. **Couverture moto et bateaux encore faible** (3 et 12 vidéos publiées) : remonter le catalogue des chaînes suivies et configurer Reddit.
2. **Validation éditoriale** : 562 vidéos attendent un humain ; c'est voulu (cas incertains), mais elle conditionne l'équilibre entre univers.
3. **Classifieur à règles** : précis sur les titres explicites, plus faible sur les titres allusifs. Avec les descriptions YouTube, quelques sujets d'entreprise passent encore (ex. interviews d'Elon Musk classées « automobile » via Tesla) : la modération ou l'analyse IA (clé Anthropic) les écarte. Les résumés éditoriaux n'existent qu'avec l'IA ou la rédaction.
4. **Recherche** lexicale uniquement (pas d'embeddings) ; à mesurer avant d'ajouter pgvector.
5. **Limiteur de débit en mémoire** (par instance) : compléter par le pare-feu de l'hébergeur.
6. **Purge à 12 mois** des propositions et signalements traités : à ajouter en tâche planifiée.
7. **Internationalisation** : interface FR/EN par cookie ; pas encore d'URL préfixées par langue pour le référencement anglais.
8. **Images de playlists** : mosaïque des miniatures officielles (pas de visuel dédié).
9. **npm audit** : 0 vulnérabilité dans les dépendances de production ; alertes modérées uniquement dans l'outillage de développement (esbuild via drizzle-kit, minimatch via typescript-eslint), à suivre lors des mises à jour.
