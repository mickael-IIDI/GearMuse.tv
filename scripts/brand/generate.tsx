/**
 * Génère l'identité visuelle GearMuse à partir de la géométrie du symbole :
 *   - src/components/brand/mark-path.ts (tracé utilisé par le composant <Logo />) ;
 *   - icônes d'application (favicon.ico, icon.svg, apple-icon.png, icônes du manifeste) ;
 *   - image de partage par défaut (opengraph-image.png) ;
 *   - kit de marque dans public/brand (symboles SVG, logotypes et avatar PNG).
 *
 * Usage : npm run brand:generate
 * Le rendu PNG passe par Playwright (Chrome) ; les polices Space Grotesk et Inter (licence OFL)
 * sont chargées depuis Google Fonts au moment de la génération : une connexion est nécessaire.
 */
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium, type Browser } from "@playwright/test";
import { IconBoat, IconCar, IconMoto, IconPlane, IconRocket } from "@/components/icons";
import { markPath } from "./geometry";

const ROOT = path.resolve(__dirname, "..", "..");
const out = (...p: string[]) => path.join(ROOT, ...p);

export const BRAND = {
  name: "GearMuse",
  parts: ["Gear", "Muse"] as const,
  domain: "gearmuse.tv",
  tagline: "Les meilleures vidéos sur les véhicules motorisés, sélectionnées pour leur valeur.",
  colors: { ink: "#0a0c0f", amber: "#ffb020", orange: "#c2410c", paper: "#f6f6f3", text: "#eef1f5", textDark: "#121418", muted: "#9aa3b2" },
};
const C = BRAND.colors;
const D = markPath();
const D_SMALL = markPath("small");
const FONTS = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;700&display=block";

// ---------- SVG ----------

const markSvg = (color: string, size?: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"${size ? ` width="${size}" height="${size}"` : ""}><path fill="${color}" fill-rule="evenodd" d="${D}"/></svg>`;

/** Symbole sur fond : tuile arrondie (radius > 0) ou carré plein (radius 0), symbole réduit à `scale`. */
const tileSvg = ({ radius = 14, scale = 0.78, bg = C.ink, fg = C.amber, size, d = D }: { radius?: number; scale?: number; bg?: string; fg?: string; size?: number; d?: string } = {}) => {
  const t = +((64 - 64 * scale) / 2).toFixed(3);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"${size ? ` width="${size}" height="${size}"` : ""}><rect width="64" height="64" rx="${radius}" fill="${bg}"/><path transform="translate(${t} ${t}) scale(${scale})" fill="${fg}" fill-rule="evenodd" d="${d}"/></svg>`;
};
/** Icône d'onglet : variante optique « petite taille », symbole agrandi dans la tuile. */
const FAVICON = { radius: 12, scale: 0.9, d: D_SMALL };

// ---------- Rendu PNG ----------

const page = (body: string, extra = "") => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${FONTS}">
<style>html,body{margin:0;padding:0;background:transparent}${extra}</style></head><body>${body}</body></html>`;

async function shoot(browser: Browser, html: string, file: string, opts: { width: number; height: number; scale?: number; transparent?: boolean; selector?: string; fonts?: boolean }) {
  const ctx = await browser.newContext({ viewport: { width: opts.width, height: opts.height }, deviceScaleFactor: opts.scale ?? 1 });
  const p = await ctx.newPage();
  await p.setContent(html, { waitUntil: "networkidle" });
  if (opts.fonts) {
    const ok = await p.evaluate(async () => {
      await document.fonts.ready;
      const a = await document.fonts.load('700 64px "Space Grotesk"');
      const b = await document.fonts.load('500 32px "Inter"');
      return a.length > 0 && b.length > 0;
    });
    if (!ok) throw new Error("Polices Google Fonts indisponibles : connexion requise pour générer les visuels avec texte.");
  }
  const buf = opts.selector
    ? await p.locator(opts.selector).screenshot({ omitBackground: opts.transparent ?? true })
    : await p.screenshot({ omitBackground: opts.transparent ?? true, clip: { x: 0, y: 0, width: opts.width, height: opts.height } });
  await ctx.close();
  if (file) write(file, buf);
  return buf;
}

function write(rel: string, data: string | Buffer) {
  const file = out(rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
  console.log(`  ${rel} (${(Buffer.byteLength(data) / 1024).toFixed(1)} Ko)`);
}

/** Fichier .ico contenant des images PNG (format accepté par tous les navigateurs actuels). */
function ico(frames: { size: number; data: Buffer }[]) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = 6 + 16 * frames.length;
  const entries = frames.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...frames.map((f) => f.data)]);
}

const wordmark = (size: number, color: string, accent: string) =>
  `<span style="font-family:'Space Grotesk';font-weight:700;font-size:${size}px;letter-spacing:-0.03em;line-height:1;color:${color};white-space:nowrap">${BRAND.parts[0]}<span style="color:${accent}">${BRAND.parts[1]}</span></span>`;

const lockup = (markSize: number, color: string, accent: string, pad = 0) =>
  `<div id="logo" style="display:inline-flex;align-items:center;gap:${Math.round(markSize * 0.24)}px;padding:${pad}px">${markSvg(accent, markSize)}${wordmark(Math.round(markSize * 0.78), color, accent)}</div>`;

const icon = (Comp: typeof IconCar) => renderToStaticMarkup(<Comp size={30} />);

function ogHtml() {
  const unis: [string, typeof IconCar][] = [
    ["Automobile", IconCar],
    ["Moto", IconMoto],
    ["Aviation", IconPlane],
    ["Nautisme", IconBoat],
    ["Autres véhicules", IconRocket],
  ];
  const chips = unis
    .map(([l, I]) => `<span style="display:inline-flex;align-items:center;gap:10px;padding:10px 18px 10px 14px;border:1.5px solid #252b34;border-radius:999px;background:#111419">${icon(I)}<span>${l}</span></span>`)
    .join("");
  return page(
    `<div style="position:relative;width:1200px;height:630px;overflow:hidden;background:${C.ink};color:${C.text};font-family:Inter">
      <div style="position:absolute;inset:0;background:radial-gradient(760px 520px at 88% 18%, rgba(255,176,32,.18), transparent 62%)"></div>
      <div style="position:absolute;right:-170px;top:40px;width:640px;height:640px;opacity:.08">${markSvg(C.amber, 640)}</div>
      <div style="position:absolute;left:80px;top:78px;right:80px;bottom:70px;display:flex;flex-direction:column">
        <div style="display:flex;align-items:center;justify-content:space-between">
          ${lockup(96, C.text, C.amber)}
        </div>
        <p style="margin:46px 0 0;max-width:900px;font-size:44px;line-height:1.22;font-weight:600;letter-spacing:-0.015em">${BRAND.tagline}</p>
        <p style="margin:22px 0 0;font-size:25px;color:${C.muted}">Notes sur 100 expliquées · Recommandations sans compte · Playlists intelligentes</p>
        <div style="margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:24px">
          <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:22px;font-weight:500;color:#cdd3dc">${chips}</div>
        </div>
        <div style="position:absolute;right:0;top:22px;font-family:'Space Grotesk';font-weight:700;font-size:30px;letter-spacing:-0.01em;color:${C.amber}">${BRAND.domain}</div>
      </div>
    </div>`,
    `svg{display:block} [aria-hidden] {color:${C.amber}}`,
  );
}

async function main() {
  console.log("Symbole et icônes");
  write(
    "src/components/brand/mark-path.ts",
    `// Fichier généré par scripts/brand/generate.tsx (npm run brand:generate) — ne pas modifier à la main.\n` +
      `/** Symbole GearMuse : engrenage à 8 dents évidé d'un triangle « lecture » (grille 64 × 64, fill-rule evenodd). */\n` +
      `export const MARK_PATH =\n  "${D}";\n`,
  );
  write("public/brand/gearmuse-mark.svg", markSvg(C.amber) + "\n");
  write("public/brand/gearmuse-mark-fond-clair.svg", markSvg(C.orange) + "\n");
  write("public/brand/gearmuse-mark-noir.svg", markSvg(C.textDark) + "\n");
  write("public/brand/gearmuse-tuile.svg", tileSvg() + "\n");
  write("src/app/icon.svg", tileSvg(FAVICON) + "\n");

  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const icoFrames = [];
    for (const size of [16, 32, 48]) {
      const data = await shoot(browser, page(tileSvg({ ...FAVICON, size })), "", { width: size, height: size });
      icoFrames.push({ size, data });
    }
    write("src/app/favicon.ico", ico(icoFrames));
    // iOS arrondit lui-même les coins : carré plein, symbole avec marge.
    await shoot(browser, page(tileSvg({ size: 180, radius: 0, scale: 0.66 })), "src/app/apple-icon.png", { width: 180, height: 180, transparent: false });
    await shoot(browser, page(tileSvg({ size: 192 })), "public/brand/icon-192.png", { width: 192, height: 192 });
    await shoot(browser, page(tileSvg({ size: 512 })), "public/brand/icon-512.png", { width: 512, height: 512 });
    // Icône « maskable » : fond plein, symbole dans la zone sûre (cercle de 80 %).
    await shoot(browser, page(tileSvg({ size: 512, radius: 0, scale: 0.58 })), "public/brand/icon-maskable-512.png", { width: 512, height: 512, transparent: false });
    // Avatar pour les réseaux et YouTube (recadrage circulaire) : carré plein, symbole centré.
    await shoot(browser, page(tileSvg({ size: 800, radius: 0, scale: 0.62 })), "public/brand/gearmuse-avatar.png", { width: 800, height: 800, transparent: false });

    console.log("Logotypes et image de partage");
    await shoot(browser, page(lockup(120, C.text, C.amber, 8)), "public/brand/gearmuse-logo-fond-sombre.png", { width: 1000, height: 300, scale: 2, selector: "#logo", fonts: true });
    await shoot(browser, page(lockup(120, C.textDark, C.orange, 8)), "public/brand/gearmuse-logo-fond-clair.png", { width: 1000, height: 300, scale: 2, selector: "#logo", fonts: true });
    await shoot(browser, ogHtml(), "src/app/opengraph-image.png", { width: 1200, height: 630, transparent: false, fonts: true });
    // Pas de saut de ligne final : le contenu est repris tel quel dans og:image:alt.
    write("src/app/opengraph-image.alt.txt", `${BRAND.name} — ${BRAND.tagline}`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
