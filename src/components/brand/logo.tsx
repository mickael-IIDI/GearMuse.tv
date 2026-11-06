import { siteConfig } from "@/config/site";
import { MARK_PATH } from "./mark-path";

/**
 * Symbole GearMuse : engrenage évidé d'un triangle « lecture » (véhicules + vidéo).
 * Couleur d'accent du thème par défaut ; tracé généré par scripts/brand/generate.tsx.
 */
export function Logo({ size = 28, className, title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path fill="var(--accent)" fillRule="evenodd" d={MARK_PATH} />
    </svg>
  );
}

/** Coupe un nom en deux à la deuxième majuscule (« GearMuse » → « Gear » + « Muse »). */
export function splitBrandName(name: string): [string, string] {
  const m = /^(.+?)([A-Z].*)$/.exec(name);
  return m ? [m[1], m[2]] : [name, ""];
}

/** Logotype : première partie en couleur de texte, seconde en couleur d'accent. */
export function Wordmark({ className = "" }: { className?: string }) {
  const [a, b] = splitBrandName(siteConfig.name);
  return (
    <span className={`font-display font-bold tracking-tight ${className}`}>
      {a}
      {b && <span className="text-accent">{b}</span>}
    </span>
  );
}
