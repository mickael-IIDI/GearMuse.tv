# Identité visuelle GearMuse

Nom : **GearMuse** — domaine : **gearmuse.tv**.

## Le symbole

Un engrenage plein à 8 dents, évidé en son centre d'un triangle « lecture » : la mécanique de tous les véhicules
motorisés (*gear*) et la vidéo (*.tv*). La pointe du triangle est alignée sur la dent de droite. Le triangle est
légèrement décalé vers la droite pour paraître centré.

- Tracé calculé (congés réguliers) dans `scripts/brand/geometry.ts`, figé dans `src/components/brand/mark-path.ts`.
- Variante optique « petite taille » (dents plus courtes, triangle agrandi) pour le favicon : la « lecture » reste
  lisible à 16 px.
- Composants : `<Logo />` (symbole, couleur d'accent du thème) et `<Wordmark />` (logotype) dans
  `src/components/brand/logo.tsx`.

## Logotype

« Gear » dans la couleur du texte, « Muse » dans la couleur d'accent, en Space Grotesk Bold (licence OFL, déjà
utilisée pour les titres du site), approche −0,03 em. Espace entre symbole et texte : environ un quart de la hauteur
du symbole.

## Couleurs

| Rôle | Thème sombre (défaut) | Thème clair |
|---|---|---|
| Accent (symbole, « Muse ») | Ambre `#ffb020` | Orange brûlé `#c2410c` |
| Fond | `#0a0c0f` | `#f6f6f3` |
| Texte | `#eef1f5` | `#121418` |

Sur fond clair, utilisez toujours la version orange brûlé : l'ambre n'y est pas assez contrasté.

## Fichiers

| Fichier | Usage |
|---|---|
| `src/app/favicon.ico` (16, 32, 48 px), `src/app/icon.svg` | Onglets de navigateur (tuile sombre, variante petite taille) |
| `src/app/apple-icon.png` (180 px) | Écran d'accueil iOS |
| `public/brand/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | Manifeste d'application (`/manifest.webmanifest`), logo JSON-LD |
| `src/app/opengraph-image.png` (1200 × 630) + `.alt.txt` | Image de partage par défaut (les pages vidéo utilisent la miniature officielle) |
| `public/brand/gearmuse-mark.svg` | Symbole ambre, pour fond sombre |
| `public/brand/gearmuse-mark-fond-clair.svg` | Symbole orange brûlé, pour fond clair |
| `public/brand/gearmuse-mark-noir.svg` | Symbole monochrome (impression, tampons) |
| `public/brand/gearmuse-tuile.svg` | Symbole sur tuile sombre arrondie |
| `public/brand/gearmuse-logo-fond-sombre.png`, `gearmuse-logo-fond-clair.png` | Logotype complet (fond transparent, 2×) |
| `public/brand/gearmuse-avatar.png` (800 px) | Photo de profil (chaîne YouTube, réseaux sociaux : recadrage rond prévu) |

Le kit est servi publiquement sous `https://gearmuse.tv/brand/…` (kit presse).

## Régénérer

```bash
npm run brand:generate
```

Le script recalcule le tracé, réécrit les SVG et rend les PNG avec Playwright (Chrome). Les polices sont chargées
depuis Google Fonts au moment du rendu : une connexion est nécessaire, et le script s'arrête si elles manquent. Un
test unitaire (`tests/unit/brand.test.ts`) vérifie que le tracé figé correspond à la géométrie.

## À éviter

Ne déformez pas le symbole et ne le faites pas pivoter. N'ajoutez ni contour ni ombre. Ne placez pas l'ambre sur
fond clair. Ne remplacez pas le triangle évidé par un triangle plein d'une autre couleur.
