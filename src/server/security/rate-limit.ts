import { createHash } from "node:crypto";

/**
 * Limiteur de débit en mémoire (fenêtre glissante simple) par adresse IP hachée.
 * Suffisant pour une instance ; en production multi-instances, complétez par le
 * pare-feu de l'hébergeur (Vercel Firewall) ou un stockage partagé.
 */
const buckets = new Map<string, number[]>();

export function clientIp(req: Request): string {
  const h = req.headers;
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}

export function ipHash(req: Request): string {
  const salt = process.env.IP_HASH_SALT || process.env.SESSION_SECRET || "gearmuse";
  return createHash("sha256").update(`${salt}:${clientIp(req)}`).digest("hex").slice(0, 32);
}

export function rateLimit(req: Request, scope: string, max: number, windowMs: number): boolean {
  const key = `${scope}:${ipHash(req)}`;
  const now = Date.now();
  const list = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) {
    buckets.set(key, list);
    return false;
  }
  list.push(now);
  buckets.set(key, list);
  if (buckets.size > 10_000) for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  return true;
}
