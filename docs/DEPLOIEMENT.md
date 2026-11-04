# Déploiement et accès nécessaires

Aucune ressource payante ni déploiement public n'a été créé : les étapes ci-dessous sont à valider et à lancer par vous.

## 1. Clés et accès

| Accès | Obligatoire ? | Où l'obtenir | Variable |
|---|---|---|---|
| Base PostgreSQL (Neon) | Oui en production | <https://neon.tech> → projet → chaîne « pooled », `sslmode=require` | `DATABASE_URL` |
| Clé YouTube Data API v3 | Fortement recommandée (gratuite, 10 000 unités/jour) | Google Cloud Console → nouveau projet → « API et services » → activer « YouTube Data API v3 » → Identifiants → Clé API (restreinte à cette API) | `YOUTUBE_API_KEY` |
| Hébergement Next.js | Oui | Vercel (ou tout hébergeur Node 20+) | — |
| Domaine | Au choix | Registrar ou Vercel | `NEXT_PUBLIC_SITE_URL` |
| Clé Anthropic | Facultative (analyse IA) | <https://console.anthropic.com> | `ANTHROPIC_API_KEY` (+ activation et budget dans l'administration) |
| Reddit OAuth | Facultatif | <https://www.reddit.com/prefs/apps> (application « script ») | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT` |
| Secrets applicatifs | Oui | `openssl rand -hex 32` | `SESSION_SECRET`, `IP_HASH_SALT`, `CRON_SECRET` |
| Compte administrateur | Oui | — | `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12 caractères min.) |
| Mentions légales | Oui avant ouverture | — | `NEXT_PUBLIC_PUBLISHER_NAME`, `NEXT_PUBLIC_PUBLICATION_DIRECTOR`, `NEXT_PUBLIC_HOSTING_PROVIDER`, `NEXT_PUBLIC_CONTACT_EMAIL` |

Avec la clé YouTube, relancez `npm run ingest -- step enrich` (environ 30 unités pour 1 500 vidéos) puis `analyze` et `score` :
durées, dates, vues, langues et descriptions alimentent alors les filtres de durée et de date, les pépites et une confiance plus élevée.

## 2. Base Neon

```bash
# .env.local ou variables de l'hébergeur
DATABASE_URL="postgresql://…-pooler.…neon.tech/neondb?sslmode=require"
npm run db:migrate                     # crée l'extension pg_trgm et les tables
npm run ingest -- pipeline             # premier catalogue (10 à 20 min ; bien plus rapide avec la clé YouTube)
ADMIN_PASSWORD='…' npm run admin:create -- vous@exemple.fr owner "Votre nom"
```

Pour reprendre le catalogue local déjà constitué plutôt que de relancer l'ingestion : `pg_dump` depuis PGlite n'étant pas
direct, la voie la plus simple est de relancer le pipeline contre Neon (les sources sont publiques et l'ingestion est déterministe).

## 3. Vercel

1. Poussez le dépôt sur GitHub, puis « Add New Project » dans Vercel en important le dépôt (framework détecté : Next.js).
2. Variables d'environnement : toutes celles du tableau (Production et Preview), `ALLOW_INDEXING=false` en préproduction.
3. Déployez. Vérifiez `https://<domaine>/api/health` (`{"ok":true,"driver":"pg",…}`).
4. Tâches planifiées : `vercel.json` déclare deux tâches quotidiennes légères (revérification de disponibilité, playlists).
   Vercel envoie automatiquement `Authorization: Bearer $CRON_SECRET`.

## 4. Ingestion quotidienne (GitHub Actions)

Le pipeline complet peut dépasser la durée maximale d'une fonction serverless : il tourne dans GitHub Actions.
Dans le dépôt : Settings → Secrets → `DATABASE_URL`, `YOUTUBE_API_KEY` (et facultativement `ANTHROPIC_API_KEY`, `REDDIT_*`) ;
Settings → Variables → `INGESTION_ENABLED=true`, `SITE_URL`, `PROJECT_NAME`. Le workflow `ingest.yml` s'exécute chaque nuit
et peut être lancé à la main.

## 5. CI

`.github/workflows/ci.yml` : lint, vérification des types, tests unitaires et build à chaque push ; tests E2E à la demande
(constitution d'un petit catalogue réel dans une base éphémère puis Playwright).

## 6. Exploitation

- Supervision : `/api/health`, tableau de bord d'administration (quotas, coûts IA, tâches, erreurs), journaux structurés de l'hébergeur.
- Sauvegardes : Neon conserve un historique de restauration (PITR) selon l'offre ; complétez par un `pg_dump` planifié si nécessaire.
- Pare-feu : activez la protection anti-abus de l'hébergeur (le limiteur intégré est par instance).
- Changement de nom : `PROJECT_NAME` / `NEXT_PUBLIC_PROJECT_NAME`, logo dans `src/components/icons.tsx` (`Logo`), couleur d'accent dans `src/app/globals.css` (`--accent`).
