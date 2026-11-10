# GearMuse — [gearmuse.tv](https://gearmuse.tv)

Médiathèque vidéo de référence pour les passionnés de **véhicules motorisés** : automobile, moto, aviation, bateaux, trains, engins, fusées.
Les vidéos (YouTube) sont **identifiées, vérifiées, classées, notées et recommandées** ; elles ne sont pas hébergées.
Ergonomie inspirée de [HackerTube](https://hackertube.org/) (Andrej Karpathy), identité visuelle et code originaux.

> État détaillé (terminé / testé / restant) : [docs/ETAT.md](docs/ETAT.md) · Identité visuelle : [docs/MARQUE.md](docs/MARQUE.md) · Mise en production : [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md)

## Démarrage rapide (local, sans aucun service externe)

```bash
npm install
npm run db:migrate                 # crée la base PostgreSQL embarquée (PGlite) dans .data/
npm run ingest -- pipeline         # constitue un vrai catalogue (Hacker News, chaînes vérifiées) — ~10 min
npm run dev                        # http://localhost:3000
```

- Administration : http://localhost:3000/admin — renseignez `ADMIN_EMAIL` / `ADMIN_PASSWORD` dans `.env.local` (le premier compte propriétaire est créé à la première connexion).
- Avec PGlite, **un seul processus** peut ouvrir la base : arrêtez `npm run dev` avant `npm run ingest`, ou lancez les tâches depuis l'administration (« Tâches automatiques »).
- Ajoutez `YOUTUBE_API_KEY` pour obtenir durées, dates, vues et langues (voir [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md)).

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` / `build` / `start` | Next.js (développement, build, production) |
| `npm run db:generate` / `db:migrate` | Générer / appliquer les migrations SQL (Drizzle) |
| `npm run db:transfer` | Copier la base locale vers PostgreSQL / Neon avant la mise en ligne (voir docs/DEPLOIEMENT.md) |
| `npm run ingest -- pipeline` | Pipeline complet (premier catalogue) |
| `npm run ingest -- daily` | Mise à jour incrémentale quotidienne |
| `npm run ingest -- step <tâche> [json]` | Une étape (ex. `step discover_hn_stories '{"fromYear":2024}'`) |
| `npm run ingest -- import <url…>` | Import manuel d'URL YouTube |
| `npm run ingest -- stats` | État du catalogue |
| `npm run admin:create -- <email> <rôle>` | Créer / modifier un administrateur (`ADMIN_PASSWORD` en variable) |
| `npm run review:apply` | Appliquer une revue éditoriale (fichiers de décisions, voir docs/REVUE-EDITORIALE.md) |
| `npm run channels:find` | Chercher des chaînes francophones candidates via l'API YouTube (liste à examiner, 4 000 unités environ) |
| `npm run brand:generate` | Régénérer le symbole, les icônes, l'image de partage et le kit de marque (voir docs/MARQUE.md) |
| `npm run lint` / `typecheck` / `test` / `test:e2e` | Qualité : ESLint, TypeScript strict, Vitest, Playwright |

## Architecture en bref

- **Next.js 16** (App Router, rendu serveur, TypeScript strict), **Tailwind CSS 4**, composants maison accessibles.
- **PostgreSQL** via **Drizzle ORM** : PGlite en local, **Neon** (ou tout PostgreSQL) en production. Recherche plein texte (dictionnaires français, anglais et simple) et trigrammes (`pg_trgm`).
- **Pipeline d'ingestion** : découverte → normalisation → enrichissement → vérification → analyse → notation → publication / file de modération → actualisation. Sources : Hacker News (API Algolia), chaînes vérifiées (Wikidata + flux RSS YouTube), YouTube Data API, Reddit (OAuth), import éditorial, propositions des visiteurs.
- **Curation explicable** : note sur 100 aux pondérations configurables ; un critère non mesurable est exclu au lieu d'être deviné ; provenance et version de chaque analyse conservées.
- **Recommandations sans compte** : bibliothèque locale (favoris, historique, plus tard, préférences) ; profil envoyé ponctuellement, jamais stocké ; recommandations expliquées.
- **Back-office** sécurisé (scrypt, sessions hachées, verrouillage, rôles, journal d'audit).

Détails : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/PIPELINE.md](docs/PIPELINE.md) · [docs/CONFORMITE.md](docs/CONFORMITE.md) · [docs/ANALYSE-HACKERTUBE.md](docs/ANALYSE-HACKERTUBE.md) · [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md)
