# État du projet — 5 novembre 2026

## Catalogue réel constitué (base locale PGlite, aucune donnée inventée)

| Indicateur | Valeur |
|---|---|
| Stories Hacker News examinées (2007-2026, ≥ 5 points, liant YouTube) | 16 457 |
| Chaînes suivies, vérifiées par RSS et actives | 57 : 28 via Wikidata + 29 moto/nautisme résolues par handle via l'API YouTube (`VERIFIED_CHANNELS`) ; « Airbus - Topic » (agrégat généré par YouTube) désactivée |
| Vidéos candidates enregistrées (Hacker News + catalogues des chaînes suivies) | 13 060 |
| Enrichies via la YouTube Data API (titre, description, mots-clés, durée, date, vues, langue, intégrabilité) | 12 971 |
| **Publiées automatiquement** (note ≥ 55, confiance ≥ 0,4, pertinence ≥ 0,55, ≤ 25 par chaîne sans recommandation) | **519** — toutes avec durée, date et vues |
| En file de validation humaine | 6 633 |
| Rejetées (hors périmètre, insuffisantes, Shorts, directs) | 5 819 |
| Indisponibles chez YouTube (supprimées / privées) | 89 |
| Pépites (recommandées, moins de 100 000 vues) | 46 |
| Vidéos de plus d'une heure publiées | 45 |
| Playlists visibles (≥ 3 vidéos publiées) | 11 sur 11 |
| Marques avec au moins une vidéo publiée | 66 |
| URL dans le sitemap | 678 |
| Consommation API YouTube du 5 novembre (enrichissements, remontée et résolution des chaînes) | 672 unités, 0 erreur (quota gratuit : 10 000 / jour) |

Répartition des vidéos publiées (univers principal) : autres véhicules (dont espace) 180, automobile 107, aviation 91,
moto 88, bateaux 53. Les 29 chaînes moto et nautisme ajoutées (FortNine, Bret Tkacs ADV, MotoJitsu, Le Repaire des Motards,
BoatTEST, Casual Navigation, Chief MAKOi, Motor Boat & Yachting…) ont fait passer la moto de 11 à 88 vidéos et les bateaux
de 26 à 53. Les candidates refusées à la vérification (homonymes renvoyés par l'API : « Vikinggothic », « BIKER SOCIAL »,
comptes quasi vides) ont été écartées.

Les vidéos issues des seules chaînes (sans recommandation communautaire) sont publiées si leur note atteint le seuil,
dans la limite de 25 par chaîne (les mieux notées) pour préserver la diversité des créateurs ; les autres partent en validation.
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

1. **Bateaux (53) encore en retrait** ; Reddit (r/boating, r/motorcycles) et la validation de la file compléteraient la couverture.
2. **Validation éditoriale** : 6 633 vidéos attendent un humain (cas incertains, chaînes sans recommandation, plafond de diversité). La file est triée par note ; la publication groupée est disponible.
3. **Classifieur à règles** : précis sur les titres explicites. Un titre qui ne cite aucun véhicule voit sa pertinence réduite et part en validation. Quelques sujets d'entreprise passent encore (ex. interviews d'Elon Musk via Tesla) ; l'analyse IA (clé Anthropic) les écarterait. Les résumés éditoriaux n'existent qu'avec l'IA ou la rédaction.
4. **Base locale PGlite sous Windows** : erreurs d'entrée/sortie intermittentes (« could not open file … Invalid argument ») observées sous forte charge avec ~7 000 vidéos ; relancer l'étape suffit, aucune donnée perdue. En exploitation, utiliser PostgreSQL (Neon).
5. **Recherche** lexicale uniquement (pas d'embeddings) ; à mesurer avant d'ajouter pgvector.
6. **Limiteur de débit en mémoire** (par instance) : compléter par le pare-feu de l'hébergeur.
7. **Purge à 12 mois** des propositions et signalements traités : à ajouter en tâche planifiée.
8. **Internationalisation** : interface FR/EN par cookie ; pas encore d'URL préfixées par langue pour le référencement anglais. Peu de vidéos en français (4 publiées ; plusieurs centaines de vidéos du Repaire des Motards et de Vilebrequin attendent en validation, faute de recommandation indépendante) : sources francophones à renforcer.
9. **Images de playlists** : mosaïque des miniatures officielles (pas de visuel dédié).
10. **npm audit** : 0 vulnérabilité dans les dépendances de production ; alertes modérées uniquement dans l'outillage de développement (esbuild via drizzle-kit, minimatch via typescript-eslint).
