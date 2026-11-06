import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { apiUsage } from "@/db/schema";
import { publicReferenceUrl, siteConfig } from "@/config/site";

export const USER_AGENT =
  process.env.INGEST_USER_AGENT || `${process.env.PROJECT_NAME || siteConfig.name}-catalog/0.1 (+${publicReferenceUrl}/a-propos)`;

export class HttpError extends Error {
  constructor(
    public status: number,
    public url: string,
    public body?: string,
  ) {
    super(`HTTP ${status} pour ${redact(url)}`);
  }
}

/** Retire les clés d'API des URL avant journalisation. */
export function redact(url: string): string {
  return url.replace(/([?&](?:key|api_key|token|access_token)=)[^&]+/gi, "$1REDACTED");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Limiteur de débit simple par hôte (intervalle minimal entre deux requêtes). */
const lastCall = new Map<string, number>();
const MIN_INTERVAL: Record<string, number> = {
  "hn.algolia.com": 120,
  "www.youtube.com": 150,
  "youtube.googleapis.com": 50,
  "www.googleapis.com": 50,
  "query.wikidata.org": 1100,
  "oauth.reddit.com": 1100,
  "www.reddit.com": 1100,
  "api.anthropic.com": 0,
};
async function throttle(url: string) {
  const host = new URL(url).hostname;
  const min = MIN_INTERVAL[host] ?? 200;
  const prev = lastCall.get(host) ?? 0;
  const wait = prev + min - Date.now();
  lastCall.set(host, Math.max(Date.now(), prev + min));
  if (wait > 0) await sleep(wait);
}

export type FetchOpts = {
  retries?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
  method?: string;
  body?: string;
  /** Codes HTTP à renvoyer tels quels (sans exception ni nouvelle tentative). */
  passStatuses?: number[];
};

export async function fetchWithRetry(url: string, opts: FetchOpts = {}): Promise<Response> {
  const retries = opts.retries ?? 3;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle(url);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20000);
    try {
      const res = await fetch(url, {
        method: opts.method ?? "GET",
        body: opts.body,
        headers: { "User-Agent": USER_AGENT, ...(opts.headers ?? {}) },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.ok || opts.passStatuses?.includes(res.status)) return res;
      const retryable = res.status === 429 || res.status >= 500;
      const body = await res.text().catch(() => "");
      if (!retryable || attempt === retries) throw new HttpError(res.status, url, body.slice(0, 500));
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 800 * 2 ** attempt);
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (e instanceof HttpError) throw e;
      if (attempt === retries) break;
      await sleep(800 * 2 ** attempt);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function fetchJson<T>(url: string, opts: FetchOpts = {}): Promise<T> {
  const res = await fetchWithRetry(url, { ...opts, headers: { Accept: "application/json", ...(opts.headers ?? {}) } });
  return (await res.json()) as T;
}

/** Exécute `fn` sur chaque élément avec une concurrence bornée. */
export async function pMap<T, R>(items: T[], fn: (item: T, index: number) => Promise<R>, concurrency = 4): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Enregistre la consommation d'une API externe (quota, requêtes, coût). */
export async function recordUsage(provider: string, delta: { units?: number; requests?: number; errors?: number; costUsd?: number }) {
  const db = await getDb();
  const day = new Date().toISOString().slice(0, 10);
  await db
    .insert(apiUsage)
    .values({
      provider,
      day,
      units: delta.units ?? 0,
      requests: delta.requests ?? 1,
      errors: delta.errors ?? 0,
      costUsd: String(delta.costUsd ?? 0),
    })
    .onConflictDoUpdate({
      target: [apiUsage.provider, apiUsage.day],
      set: {
        units: sql`${apiUsage.units} + ${delta.units ?? 0}`,
        requests: sql`${apiUsage.requests} + ${delta.requests ?? 1}`,
        errors: sql`${apiUsage.errors} + ${delta.errors ?? 0}`,
        costUsd: sql`${apiUsage.costUsd} + ${delta.costUsd ?? 0}`,
      },
    });
}

export async function usageToday(provider: string): Promise<{ units: number; requests: number; costUsd: number }> {
  const db = await getDb();
  const day = new Date().toISOString().slice(0, 10);
  const r = await db.query.apiUsage.findFirst({ where: (u, { and, eq }) => and(eq(u.provider, provider), eq(u.day, day)) });
  return { units: r?.units ?? 0, requests: r?.requests ?? 0, costUsd: Number(r?.costUsd ?? 0) };
}
