# Déploiement et accès nécessaires

Aucune ressource payante ni déploiement public n'a été créé : les étapes ci-dessous sont à valider et à lancer par vous.

## 1. Clés et accès

| Accès | Obligatoire ? | Où l'obtenir | Variable |
|---|---|---|---|
| Base PostgreSQL (Neon) | Oui en production | <https://neon.tech> → projet → chaîne « pooled », `sslmode=require` | `DATABASE_URL` |
| Clé YouTube Data API v3 | Fortement recommandée (gratuite, 10 000 unités/jour) | Google Cloud Console → nouveau projet → « API et services » → activer « YouTube Data API v3 » → Identifiants → Clé API (restreinte à cette API) | `YOUTUBE_API_KEY` |
| Hébergement Next.js | Oui | Vercel (ou tout hébergeur Node 20+) | — |
| Domaine | **gearmuse.tv** (acheté) | Zone DNS chez le registrar, ou serveurs de noms Vercel | `NEXT_PUBLIC_SITE_URL=https://gearmuse.tv` |
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

**Attention au catalogue local.** Relancer le pipeline contre Neon reconstitue les vidéos, mais pas les décisions éditoriales des
revues (près de 11 400 décisions enregistrées dans la base PGlite locale) : les vidéos concernées resteraient en validation, et le
catalogue publié serait bien plus petit. Il faut donc transférer la base locale vers Neon avant la mise en ligne, sans relancer le pipeline.

## 3. Vercel

1. Poussez le dépôt sur GitHub, puis « Add New Project » dans Vercel en important le dépôt (framework détecté : Next.js).
2. Variables d'environnement : toutes celles du tableau (Production et Preview), `ALLOW_INDEXING=false` en préproduction.
3. Déployez. Vérifiez `https://gearmuse.tv/api/health` (`{"ok":true,"driver":"pg",…}`) une fois le domaine relié (section 3 bis).
4. Tâches planifiées : `vercel.json` déclare deux tâches quotidiennes légères (revérification de disponibilité, playlists).
   Vercel envoie automatiquement `Authorization: Bearer $CRON_SECRET`.

## 3 bis. Domaine gearmuse.tv

Le code est prêt pour ce domaine : un build de production sans `NEXT_PUBLIC_SITE_URL` utilise `https://gearmuse.tv`
(`src/config/site.ts`), et toutes les URL absolues en découlent (canonical, Open Graph, sitemap, robots.txt, JSON-LD, manifeste).

1. Vercel → projet → Settings → Domains → ajoutez `gearmuse.tv` (domaine principal) puis `www.gearmuse.tv`
   en choisissant « Redirect to gearmuse.tv ». **Ne choisissez pas l'inverse** (apex vers www) : le code redirige déjà
   www vers l'apex, et deux règles opposées formeraient une boucle.
2. Chez le registrar du .tv, créez les enregistrements que Vercel affiche pour ce projet : un enregistrement **A** pour
   `@` (adresse IPv4 indiquée par Vercel) et un **CNAME** pour `www` (cible propre au projet indiquée par Vercel).
   Les valeurs sont désormais spécifiques à chaque projet : recopiez celles de l'écran Domains. Autre option : déléguer
   le domaine aux serveurs de noms de Vercel. Supprimez les enregistrements de parking du registrar sur `@` et `www`.
3. Attendez la validation (de quelques minutes à quelques heures) : Vercel émet alors le certificat HTTPS.
4. Variables d'environnement **Production** : `NEXT_PUBLIC_SITE_URL=https://gearmuse.tv`, `ALLOW_INDEXING=true`.
   En **Preview** : `ALLOW_INDEXING=false` ; les pages des prévisualisations gardent leur canonical vers gearmuse.tv.
5. Vérifications :
   - `https://www.gearmuse.tv/videos` renvoie une redirection permanente vers `https://gearmuse.tv/videos` ;
   - `https://gearmuse.tv/robots.txt` cite `https://gearmuse.tv/sitemap.xml` ;
   - le code source de l'accueil contient `<link rel="canonical" href="https://gearmuse.tv">` et une balise `og:image` ;
   - l'adresse `*.vercel.app` répond avec l'en-tête `X-Robots-Tag: noindex` (pas de contenu dupliqué).
6. Référencement : déclarez `https://gearmuse.tv` dans Google Search Console (validation par enregistrement TXT chez
   le registrar) et soumettez `https://gearmuse.tv/sitemap.xml` ; idem dans Bing Webmaster Tools.
7. E-mail : `NEXT_PUBLIC_CONTACT_EMAIL` n'est affiché que s'il est renseigné. Créez d'abord la boîte ou la redirection
   (ex. `contact@gearmuse.tv`, souvent proposée gratuitement par le registrar, avec ses enregistrements MX), puis
   renseignez la variable.

## 4. Ingestion quotidienne (GitHub Actions)

Le pipeline complet peut dépasser la durée maximale d'une fonction serverless : il tourne dans GitHub Actions.
Dans le dépôt : Settings → Secrets → `DATABASE_URL`, `YOUTUBE_API_KEY` (et facultativement `ANTHROPIC_API_KEY`, `REDDIT_*`) ;
Settings → Variables → `INGESTION_ENABLED=true`, `SITE_URL=https://gearmuse.tv`, `PROJECT_NAME=GearMuse`. Le workflow `ingest.yml` s'exécute chaque nuit
et peut être lancé à la main.

## 5. CI

`.github/workflows/ci.yml` : lint, vérification des types, tests unitaires et build à chaque push ; tests E2E à la demande
(constitution d'un petit catalogue réel dans une base éphémère puis Playwright).

## 6. Exploitation

- Supervision : `/api/health`, tableau de bord d'administration (quotas, coûts IA, tâches, erreurs), journaux structurés de l'hébergeur.
- Sauvegardes : Neon conserve un historique de restauration (PITR) selon l'offre ; complétez par un `pg_dump` planifié si nécessaire.
- Pare-feu : activez la protection anti-abus de l'hébergeur (le limiteur intégré est par instance).
- Identité visuelle : voir [MARQUE.md](MARQUE.md). Nom : `PROJECT_NAME` / `NEXT_PUBLIC_PROJECT_NAME` ; symbole, icônes et image de partage régénérés par `npm run brand:generate` ; couleur d'accent dans `src/app/globals.css` (`--accent`).
