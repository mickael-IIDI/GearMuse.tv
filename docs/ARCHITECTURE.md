# Architecture

## Choix techniques

| Besoin | Choix | Raison |
|---|---|---|
| Application web | Next.js 16.4 (App Router, Turbopack), React 19, TypeScript strict | Rendu serveur indexable, routes API et actions serveur dans un seul projet |
| Cache | Modèle classique (sans `cacheComponents`), pages dynamiques + en-têtes `Cache-Control` sur les API | Simplicité et prévisibilité ; la base sert des requêtes indexées rapides |
| Style | Tailwind CSS 4 + jetons CSS (`--accent`, `--bg`…) | Thèmes sombre/clair/système sans dépendance |
| Base | PostgreSQL + Drizzle ORM | Typage, migrations SQL versionnées (`drizzle/`) |
| Base locale | PGlite (PostgreSQL WebAssembly, extension `pg_trgm`) | Zéro installation ; mêmes requêtes qu'en production |
| Base production | Neon (ou tout PostgreSQL 15+), pilote `pg` | Serverless, branches, sauvegardes |
| Recherche | `tsvector` généré (pondérations A/B/C, dictionnaires simple + french + english) et index GIN, trigrammes | Suffisant et rapide jusqu'à plusieurs centaines de milliers de vidéos ; pas de service supplémentaire |
| IA | SDK officiel Anthropic, sorties JSON contraintes, désactivée par défaut | Optionnelle ; repli sur un classifieur à règles explicable |
| Tests | Vitest (unitaires), Playwright (E2E, Chrome installé ou Chromium) | Couverture des fonctions pures et des parcours |

La recherche vectorielle n'a pas été ajoutée : la recherche lexicale enrichie (synonymes FR/EN, expressions, correction
orthographique, termes d'intention) donne de bons résultats sur un vocabulaire technique riche en noms propres. Elle pourra
être ajoutée (pgvector, disponible sur Neon) si une mesure montre un gain.

## Arborescence

```
src/
  app/(site)/…           pages publiques (accueil, univers, vidéo, recherche, playlists, bibliothèque…)
  app/admin/…            back-office (connexion, (panel)/… protégées, actions.ts = actions serveur)
  app/api/…              videos, suggest, recommandations, contributions, cron/[task], health
  components/            shell, marque (symbole, logotype), cartes, filtres, lecteur, bibliothèque locale, admin
  config/site.ts         nom, URL, contact (variables d'environnement)
  db/schema.ts           schéma Drizzle (30 tables) ; client.ts (PGlite / pg) ; migrate.ts
  lib/                   texte, filtres, i18n, synonymes, taxonomie (données, marques, classifieur, sources)
  server/
    ingest/              http (débit, reprises, quotas), hn, youtube, reddit, wikidata, ai, pipeline, discovery, jobs
    curation/score.ts    notation explicable et décision de publication
    catalog/             amorçage taxonomie, compteurs, playlists intelligentes
    queries/             lecture catalogue, recherche, suggestions
    recommend.ts         moteur « Pour vous »
    auth/                mots de passe scrypt, sessions, amorçage du premier compte
    security/            limitation de débit
scripts/                 db-migrate, ingest (CLI), create-admin, apply-review, brand/ (identité visuelle)
tests/unit, tests/e2e    Vitest, Playwright
drizzle/                 migrations SQL générées
```

## Modèle de données (principales tables)

- `videos` : métadonnées fournisseur, disponibilité, statut (`discovered`, `pending_review`, `published`, `rejected`, `excluded`, `unavailable`), verrou éditorial, note, confiance, détail de la note (JSON), agrégats de recommandations, textes de recherche normalisés et `search_vector` généré.
- `creators`, `sources`, `video_sources` (chaque mention d'une vidéo dans une source), `recommendation_evidence` (preuves : vote, commentaire, sélection éditoriale, chaîne suivie… avec clé d'indépendance).
- Taxonomie : `categories` (univers, thèmes, formats, technologies), `subcategories`, `tags`, `brands`, `vehicle_models` et tables d'association `video_*` (source de l'affectation : `heuristic`, `ai`, `editor` ; confiance).
- Curation : `editorial_reviews`, `ai_analysis` (moteur, modèle, version de prompt, empreinte de l'entrée, sortie, jetons, coût).
- Ingestion : `ingestion_jobs` (statut, statistiques, point de reprise), `job_events`, `import_batches`, `api_usage` (quotas et coûts par jour).
- Playlists : `playlists` (éditoriales ou à règles, SEO), `playlist_items` (ordre, épinglage, note de curation).
- Administration : `admin_users`, `admin_sessions` (empreinte du jeton), `audit_logs`, `app_settings` (pondérations, seuils, IA).
- Contributions : `video_suggestions`, `content_reports`.

Contraintes : clés uniques (fournisseur + identifiant, slug, preuves par source), clés étrangères, contraintes `CHECK` (statuts, plages de notes, rôles), index par statut et par critère de tri, GIN plein texte et trigrammes.

## Recommandations

1. Profil local → caractéristiques pondérées (favoris ×3, plus tard ×1,5, historique décroissant, univers choisis ×4, formats ×2).
2. Candidats en SQL par recouvrement (sous-catégories, marques, modèles, tags, catégories, chaînes).
3. Score = 58 % similarité + 32 % qualité + 6 % découverte + adéquation de durée + petite part aléatoire (graine locale).
4. Diversité : 2 vidéos maximum par chaîne et 4 par sous-catégorie et par page ; environ un quart d'exploration d'univers peu présents.
5. Chaque carte porte sa raison (« Recommandée car vous aimez : restauration automobile », « Une découverte dans l'univers : aviation »…).
6. Démarrage à froid : incontournables, intérêt technique, pépites, un peu de chaque univers, entrelacés.

## Sécurité

Sessions administrateur à jeton aléatoire (cookie httpOnly, SameSite=Strict, Secure en production, seule l'empreinte stockée),
mots de passe scrypt, verrouillage après 5 échecs, limitation de débit des connexions et formulaires, contrôle de rôle
(lecteur, éditeur, administrateur, propriétaire) dans chaque page et action, vérification d'origine des actions serveur par
Next.js, validation zod des entrées, CSP stricte (YouTube uniquement), en-têtes de sécurité, `noindex` sur l'administration,
secrets uniquement en variables d'environnement, journal d'audit.
