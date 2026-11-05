# État du projet — 5 novembre 2026

## Catalogue réel constitué (base locale PGlite, aucune donnée inventée)

| Indicateur | Valeur |
|---|---|
| Stories Hacker News examinées (2007-2026, ≥ 5 points, liant YouTube) | 16 457 |
| Chaînes spécialisées vérifiées (Wikidata + flux RSS) et actives | 28 (« Airbus - Topic », chaîne agrégée générée par YouTube, désactivée) |
| Vidéos candidates enregistrées (Hacker News + catalogues des chaînes suivies) | 7 264 |
| Enrichies via la YouTube Data API (titre, description, mots-clés, durée, date, vues, langue, intégrabilité) | 7 175 |
| **Publiées automatiquement** (note ≥ 55, confiance ≥ 0,4, pertinence ≥ 0,55) | **420** — toutes avec durée, date et vues |
| En file de validation humaine | 3 556 |
| Rejetées (hors périmètre, insuffisantes, Shorts, directs) | 3 199 (dont 1 734 Shorts et 10 directs) |
| Indisponibles chez YouTube (supprimées / privées) | 89 |
| Pépites (recommandées, moins de 100 000 vues) | 48 |
| Vidéos de plus d'une heure publiées | 44 |
| Playlists visibles (≥ 3 vidéos publiées) | 11 sur 11 |
| Marques avec au moins une vidéo publiée | 54 |
| URL dans le sitemap | 554 |
| Consommation API YouTube du 5 novembre (enrichissements + remontée des chaînes) | 358 unités, 0 erreur (quota gratuit : 10 000 / jour) |

Répartition des vidéos publiées (univers principal) : autres véhicules (dont espace) 180, automobile 107, aviation 96,
bateaux 26, moto 11. La remontée des chaînes (500 dernières vidéos des chaînes moto et nautisme, 200 pour les autres)
a quadruplé la moto et doublé les bateaux, mais ces univers restent minoritaires : peu de chaînes moto/nautisme sont
vérifiables via Wikidata (Cycle World, MotoGP, Drachinifel). Pistes : ajouter des chaînes depuis l'administration
(Sources → identifiant UC…), configurer Reddit (r/motorcycles, r/boating), valider la file de modération.

Les vidéos issues des seules chaînes (sans recommandation communautaire) sont publiées si leur note atteint le seuil
grâce à la crédibilité de la chaîne et au contenu (explications, documentaires) ; les autres partent en validation.
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

1. **Moto (11) et bateaux (26) encore minoritaires** : ajouter des chaînes spécialisées, configurer Reddit, valider la file.
2. **Validation éditoriale** : 3 556 vidéos attendent un humain (cas incertains, chaînes sans recommandation). La file est triée par note ; la publication groupée est disponible.
3. **Classifieur à règles** : précis sur les titres explicites. Un titre qui ne cite aucun véhicule voit sa pertinence réduite et part en validation. Quelques sujets d'entreprise passent encore (ex. interviews d'Elon Musk via Tesla) ; l'analyse IA (clé Anthropic) les écarterait. Les résumés éditoriaux n'existent qu'avec l'IA ou la rédaction.
4. **Base locale PGlite sous Windows** : erreurs d'entrée/sortie intermittentes (« could not open file … Invalid argument ») observées sous forte charge avec ~7 000 vidéos ; relancer l'étape suffit, aucune donnée perdue. En exploitation, utiliser PostgreSQL (Neon).
5. **Recherche** lexicale uniquement (pas d'embeddings) ; à mesurer avant d'ajouter pgvector.
6. **Limiteur de débit en mémoire** (par instance) : compléter par le pare-feu de l'hébergeur.
7. **Purge à 12 mois** des propositions et signalements traités : à ajouter en tâche planifiée.
8. **Internationalisation** : interface FR/EN par cookie ; pas encore d'URL préfixées par langue pour le référencement anglais. Peu de vidéos en français (4 publiées) : sources francophones à ajouter.
9. **Images de playlists** : mosaïque des miniatures officielles (pas de visuel dédié).
10. **npm audit** : 0 vulnérabilité dans les dépendances de production ; alertes modérées uniquement dans l'outillage de développement (esbuild via drizzle-kit, minimatch via typescript-eslint).
