import "./_env";
/**
 * Copie la base locale PGlite vers une base PostgreSQL (Neon en production) : schéma par les migrations,
 * puis toutes les données avec leurs identifiants (vidéos, sources, décisions de revue, journal…).
 *
 * Les comptes et sessions d'administration ne sont pas copiés : le premier compte de production est créé
 * à la première connexion avec ADMIN_EMAIL / ADMIN_PASSWORD. Les références à un compte local deviennent vides.
 *
 * Usage (arrêtez d'abord le serveur de développement : la base locale n'accepte qu'un processus) :
 *   TARGET_DATABASE_URL="postgresql://…?sslmode=require" npm run db:transfer -- --dry-run   contrôle, sans écriture
 *   TARGET_DATABASE_URL="postgresql://…?sslmode=require" npm run db:transfer               copie
 * Options :
 *   --replace   vide d'abord une base cible qui contient déjà des données (comptes d'administration conservés)
 *   --slim      ne garde que la dernière analyse de chaque vidéo (l'historique n'est pas utilisé par le site)
 * Essai local : TARGET_DATABASE_URL=pglite:./.data/pglite-copie
 */
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import path from "node:path";

// La source est toujours la base locale, même si DATABASE_URL pointe déjà vers la production.
process.env.DATABASE_URL = "";

type Rows<T> = { rows: T[] };
type Conn = { query: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<Rows<T>>; close: () => Promise<void> };
export type Column = { name: string; dataType: string; identity: boolean };

const EXCLUDED_TABLES = new Set(["admin_users", "admin_sessions"]);
const SLIM_FILTERS: Record<string, string> = {
  ai_analysis: "id in (select distinct on (video_id) id from ai_analysis order by video_id, created_at desc, id desc)",
};
const MAX_PARAMS = 30000;
const MAX_BATCH = 500;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const replace = args.includes("--replace");
const slim = args.includes("--slim");
const q = (name: string) => `"${name.replace(/"/g, '""')}"`;
const fmt = (n: number) => n.toLocaleString("fr-FR");

async function openSource(): Promise<Conn> {
  const { getDb, closeDb } = await import("@/db/client");
  const db = await getDb();
  const client = (db as unknown as { $client: PGlite }).$client;
  return { query: (text, params) => client.query(text, params) as never, close: closeDb };
}

async function openTarget(url: string): Promise<Conn & { kind: "pg" | "pglite"; migrate: () => Promise<void> }> {
  const migrationsFolder = path.resolve("./drizzle");
  if (url.startsWith("pglite:")) {
    const client = await PGlite.create(path.resolve(url.slice("pglite:".length)), { extensions: { pg_trgm } });
    return {
      kind: "pglite",
      query: (text, params) => client.query(text, params) as never,
      close: () => client.close(),
      migrate: async () => {
        await client.exec("create extension if not exists pg_trgm");
        const { drizzle } = await import("drizzle-orm/pglite");
        const { migrate } = await import("drizzle-orm/pglite/migrator");
        await migrate(drizzle(client), { migrationsFolder });
      },
    };
  }
  if (!/^postgres(ql)?:\/\//.test(url)) throw new Error("TARGET_DATABASE_URL doit commencer par postgresql:// (ou pglite: pour un essai local).");
  const { Client } = await import("pg");
  const client = new Client({ connectionString: url, ssl: /sslmode=require|neon\.tech/.test(url) ? { rejectUnauthorized: true } : undefined });
  await client.connect();
  return {
    kind: "pg",
    query: (text, params) => client.query(text, params as unknown[]) as never,
    close: () => client.end(),
    migrate: async () => {
      await client.query("create extension if not exists pg_trgm");
      const { drizzle } = await import("drizzle-orm/node-postgres");
      const { migrate } = await import("drizzle-orm/node-postgres/migrator");
      await migrate(drizzle(client), { migrationsFolder });
    },
  };
}

/** Tables de la source, ordonnées pour que chaque table référencée soit copiée avant celles qui la référencent. */
async function plan(src: Conn) {
  const tables = (await src.query<{ name: string }>(`select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' order by 1`)).rows.map((r) => r.name);
  const fks = (
    await src.query<{ tbl: string; ref: string; col: string }>(`
      select cl.relname as tbl, rf.relname as ref, a.attname as col
      from pg_constraint con
      join pg_class cl on cl.oid = con.conrelid
      join pg_class rf on rf.oid = con.confrelid
      join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
      where con.contype = 'f' and cl.relnamespace = 'public'::regnamespace`)
  ).rows;
  const deps = new Map(tables.map((t) => [t, new Set(fks.filter((f) => f.tbl === t && f.ref !== t).map((f) => f.ref))]));
  const ordered: string[] = [];
  while (ordered.length < tables.length) {
    const ready = tables.filter((t) => !ordered.includes(t) && [...deps.get(t)!].every((d) => ordered.includes(d)));
    if (!ready.length) throw new Error("Références circulaires entre tables : ordre de copie impossible.");
    ordered.push(...ready);
  }
  const columns = new Map<string, Column[]>();
  for (const t of tables) {
    const cols = await src.query<{ name: string; data_type: string; is_generated: string; is_identity: string }>(
      `select column_name as name, data_type, is_generated, is_identity from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position`,
      [t],
    );
    columns.set(t, cols.rows.filter((c) => c.is_generated !== "ALWAYS").map((c) => ({ name: c.name, dataType: c.data_type, identity: c.is_identity === "YES" })));
  }
  // Colonnes qui référencent une table non copiée : leur valeur devient vide.
  const nulled = new Map<string, Set<string>>();
  for (const f of fks) if (EXCLUDED_TABLES.has(f.ref) && !EXCLUDED_TABLES.has(f.tbl)) nulled.set(f.tbl, (nulled.get(f.tbl) ?? new Set()).add(f.col));
  const primaryKeys = new Map<string, string[]>();
  for (const t of tables) {
    const pk = await src.query<{ col: string }>(
      `select a.attname as col from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey) where i.indrelid = $1::regclass and i.indisprimary`,
      [q(t)],
    );
    primaryKeys.set(t, pk.rows.map((r) => r.col));
  }
  return { tables: ordered.filter((t) => !EXCLUDED_TABLES.has(t)), columns, nulled, primaryKeys };
}

const filterOf = (t: string) => (slim && SLIM_FILTERS[t] ? ` where ${SLIM_FILTERS[t]}` : "");

/** Valeur prête pour le pilote cible : JSON sérialisé (sinon un tableau JSON serait pris pour un tableau PostgreSQL). */
export function prepare(v: unknown, c: Pick<Column, "dataType">): unknown {
  if (v === null || v === undefined) return null;
  if (c.dataType === "json" || c.dataType === "jsonb") return JSON.stringify(v);
  if (typeof v === "bigint") return v.toString();
  if (c.dataType === "date" && v instanceof Date) return v.toISOString().slice(0, 10);
  return v;
}

async function count(conn: Conn, t: string, where = "") {
  return Number((await conn.query<{ n: number }>(`select count(*)::int as n from ${q(t)}${where}`)).rows[0].n);
}

async function main() {
  const targetUrl = process.env.TARGET_DATABASE_URL?.trim();
  if (!targetUrl && !dryRun) throw new Error("Indiquez la base cible : TARGET_DATABASE_URL=postgresql://… (ou --dry-run pour un simple contrôle de la source).");

  const src = await openSource();
  const p = await plan(src);
  const expected = new Map<string, number>();
  for (const t of p.tables) expected.set(t, await count(src, t, filterOf(t)));
  console.log(`Source : ${p.tables.length} tables, ${fmt([...expected.values()].reduce((a, b) => a + b, 0))} lignes${slim ? " (analyses : dernière par vidéo)" : ""}.`);
  console.log(`Non copiées : ${[...EXCLUDED_TABLES].join(", ")} ; références vidées : ${[...p.nulled].map(([t, c]) => `${t}.${[...c].join("/")}`).join(", ")}`);

  if (!targetUrl) {
    console.table(p.tables.map((t) => ({ table: t, lignes: expected.get(t) })));
    await src.close();
    return;
  }

  const dst = await openTarget(targetUrl);
  try {
    const version = (await dst.query<{ v: string }>("select current_setting('server_version') as v")).rows[0].v;
    const hasSchema = Boolean((await dst.query<{ t: string | null }>("select to_regclass('public.videos')::text as t")).rows[0].t);
    const existing = hasSchema ? await count(dst, "videos") : 0;
    console.log(`Cible (${dst.kind}, PostgreSQL ${version}) : ${hasSchema ? `schéma présent, ${fmt(existing)} vidéo(s)` : "vide"}.`);
    if (existing > 0 && !replace) throw new Error(`La base cible contient déjà ${fmt(existing)} vidéo(s). Relancez avec --replace pour la remplacer (les comptes d'administration de la cible sont conservés).`);
    if (dryRun) {
      console.log("Contrôle terminé, aucune écriture.");
      return;
    }

    console.log("Migrations…");
    await dst.migrate();
    const started = Date.now();
    await dst.query("begin");
    try {
      if (replace) await dst.query(`truncate table ${p.tables.map(q).join(", ")} restart identity cascade`);
      for (const t of p.tables) {
        const cols = p.columns.get(t)!;
        const nulled = p.nulled.get(t) ?? new Set<string>();
        const order = (p.primaryKeys.get(t)!.length ? p.primaryKeys.get(t)! : cols.map((c) => c.name)).map(q).join(", ");
        const batch = Math.max(1, Math.min(MAX_BATCH, Math.floor(MAX_PARAMS / cols.length)));
        const overriding = cols.some((c) => c.identity) ? " overriding system value" : "";
        const head = `insert into ${q(t)} (${cols.map((c) => q(c.name)).join(", ")})${overriding} values `;
        const t0 = Date.now();
        let copied = 0;
        for (let offset = 0; ; offset += batch) {
          const rows = (await src.query<Record<string, unknown>>(`select ${cols.map((c) => q(c.name)).join(", ")} from ${q(t)}${filterOf(t)} order by ${order} limit ${batch} offset ${offset}`)).rows;
          if (!rows.length) break;
          const params: unknown[] = [];
          const tuples = rows.map((r) => `(${cols.map((c) => (params.push(nulled.has(c.name) ? null : prepare(r[c.name], c)), `$${params.length}`)).join(", ")})`);
          await dst.query(head + tuples.join(", "), params);
          copied += rows.length;
          if (rows.length < batch) break;
        }
        for (const c of cols.filter((x) => x.identity)) {
          await dst.query(`select setval(pg_get_serial_sequence($1, $2), coalesce((select max(${q(c.name)}) from ${q(t)}), 0) + 1, false)`, [q(t), c.name]);
        }
        if (copied) console.log(`  ${t} : ${fmt(copied)} ligne(s) en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
      }
      await dst.query("commit");
    } catch (e) {
      await dst.query("rollback");
      throw e;
    }
    await dst.query("analyze");

    const mismatches: string[] = [];
    for (const t of p.tables) {
      const n = await count(dst, t);
      if (n !== expected.get(t)) mismatches.push(`${t} : ${fmt(n)} au lieu de ${fmt(expected.get(t)!)}`);
    }
    const size = (await dst.query<{ s: string }>("select pg_size_pretty(pg_database_size(current_database())) as s")).rows[0].s;
    if (mismatches.length) throw new Error(`Comptes différents après copie :\n  ${mismatches.join("\n  ")}`);
    console.log(`Copie vérifiée : ${p.tables.length} tables identiques en ${Math.round((Date.now() - started) / 1000)} s ; taille de la base cible : ${size}.`);
  } finally {
    await dst.close();
    await src.close();
  }
}

// Exécution seulement en ligne de commande (le module est aussi importé par les tests).
if (/transfer-db\.ts$/.test(process.argv[1] ?? "")) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
