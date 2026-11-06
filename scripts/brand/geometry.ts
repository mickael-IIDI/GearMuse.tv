/**
 * Géométrie du symbole GearMuse : un engrenage plein (8 dents) dont le moyeu est
 * évidé en triangle « lecture ». Grille de 64 × 64, centre (32, 32).
 * Le tracé est calculé (congés réguliers) puis figé dans src/components/brand/mark-path.ts.
 */

type Pt = { x: number; y: number; r: number };
const f = (n: number) => +n.toFixed(2);

/** Polygone à coins arrondis : chaque sommet porte son rayon de congé (0 = angle vif). */
function roundedPath(pts: Pt[]): string {
  const n = pts.length;
  const corners = pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    const l1 = Math.hypot(p.x - a.x, p.y - a.y);
    const l2 = Math.hypot(b.x - p.x, b.y - p.y);
    const u1 = { x: (p.x - a.x) / l1, y: (p.y - a.y) / l1 };
    const u2 = { x: (b.x - p.x) / l2, y: (b.y - p.y) / l2 };
    const turn = Math.acos(Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y)));
    const tan = Math.tan(turn / 2) || 1e-9;
    const t = Math.min(p.r * tan, l1 / 2, l2 / 2);
    const r = t / tan;
    const sweep = u1.x * u2.y - u1.y * u2.x > 0 ? 1 : 0;
    return { p1: { x: p.x - u1.x * t, y: p.y - u1.y * t }, p2: { x: p.x + u2.x * t, y: p.y + u2.y * t }, r, sweep };
  });
  let d = "";
  corners.forEach((c, i) => {
    d += `${i === 0 ? "M" : "L"}${f(c.p1.x)} ${f(c.p1.y)}`;
    if (c.r > 0.01) d += `A${f(c.r)} ${f(c.r)} 0 0 ${c.sweep} ${f(c.p2.x)} ${f(c.p2.y)}`;
  });
  return d + "Z";
}

export type GearOptions = { teeth: number; ro: number; rr: number; tip: number; root: number; rTip: number; rRoot: number };

/** Contour de l'engrenage (sens horaire) : arcs de tête et de pied échantillonnés, congés aux coins des dents. */
export function gearPath(o: GearOptions, cx = 32, cy = 32): string {
  const pts: Pt[] = [];
  const step = 360 / o.teeth;
  const P = (r: number, deg: number, rc: number): Pt => {
    const a = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), r: rc };
  };
  for (let i = 0; i < o.teeth; i++) {
    const c = i * step;
    pts.push(P(o.rr, c - o.root / 2, o.rRoot));
    pts.push(P(o.ro, c - o.tip / 2, o.rTip));
    for (let k = 1; k < 6; k++) pts.push(P(o.ro, c - o.tip / 2 + (o.tip * k) / 6, 0));
    pts.push(P(o.ro, c + o.tip / 2, o.rTip));
    pts.push(P(o.rr, c + o.root / 2, o.rRoot));
    const gap = step - o.root;
    for (let k = 1; k < 6; k++) pts.push(P(o.rr, c + o.root / 2 + (gap * k) / 6, 0));
  }
  return roundedPath(pts);
}

/** Triangle « lecture » arrondi pointant à droite (sens antihoraire, donc évidé), légèrement décalé pour le centrage optique. */
export function playPath(size: number, radius: number, shift: number, cx = 32, cy = 32): string {
  const pts: Pt[] = [0, 120, 240].map((deg) => ({
    x: cx + shift + size * Math.cos((deg * Math.PI) / 180),
    y: cy + size * Math.sin((deg * Math.PI) / 180),
    r: radius,
  }));
  return roundedPath(pts.reverse());
}

export const MARK_GEAR: GearOptions = { teeth: 8, ro: 31, rr: 25.5, tip: 20, root: 30, rTip: 1.8, rRoot: 1.5 };
export const MARK_PLAY = { size: 15.5, radius: 3.2, shift: 1.6 };

/**
 * Variante optique pour les très petites tailles (favicon 16-48 px) : dents plus courtes et plus larges,
 * triangle agrandi, pour que la « lecture » reste visible à 16 px.
 */
export const MARK_GEAR_SMALL: GearOptions = { ...MARK_GEAR, rr: 26.5, tip: 22, root: 31 };
export const MARK_PLAY_SMALL = { size: 17.5, radius: 3, shift: 1.8 };

/** Tracé complet du symbole (à remplir avec fill-rule="evenodd"). */
export function markPath(variant: "regular" | "small" = "regular"): string {
  const [g, p] = variant === "small" ? [MARK_GEAR_SMALL, MARK_PLAY_SMALL] : [MARK_GEAR, MARK_PLAY];
  return gearPath(g) + playPath(p.size, p.radius, p.shift);
}
