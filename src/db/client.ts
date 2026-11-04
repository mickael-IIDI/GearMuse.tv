import fs from "node:fs";
import path from "node:path";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

/**
 * Accès base de données.
 *
 * - Production / Neon : DATABASE_URL=postgres://… → pilote node-postgres (pool).
 * - Développement local sans serveur : PGlite (PostgreSQL compilé en WebAssembly)
 *   stocké dans PGLITE_DIR (par défaut ./.data/pglite). Un seul processus à la fois
 *   peut ouvrir ce répertoire : un verrou empêche les accès concurrents.
 *
 * Les deux pilotes exposent la même API Drizzle ; le type commun est NodePgDatabase.
 */
export type DB = NodePgDatabase<typeof schema>;

type Holder = { db?: DB; ready?: Promise<DB>; driver?: "pg" | "pglite"; close?: () => Promise<void> };
const g = globalThis as unknown as { __vehiculeDb?: Holder };
const holder: Holder = (g.__vehiculeDb ??= {});

export function databaseDriver(): "pg" | "pglite" {
  const url = process.env.DATABASE_URL;
  return url && /^postgres(ql)?:\/\//.test(url) ? "pg" : "pglite";
}

export function pgliteDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.PGLITE_DIR || "./.data/pglite");
}

function acquireLock(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
  const lockFile = path.join(path.dirname(dir), `${path.basename(dir)}.lock`);
  try {
    const existing = Number(fs.readFileSync(lockFile, "utf8"));
    if (existing && existing !== process.pid) {
      let alive = false;
      try {
        process.kill(existing, 0);
        alive = true;
      } catch {
        alive = false;
      }
      if (alive) {
        throw new Error(
          `La base locale PGlite (${dir}) est déjà ouverte par le processus ${existing}. ` +
            `Arrêtez le serveur de développement ou lancez l'ingestion depuis l'administration.`,
        );
      }
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  fs.writeFileSync(lockFile, String(process.pid));
  const release = () => {
    try {
      if (Number(fs.readFileSync(lockFile, "utf8")) === process.pid) fs.unlinkSync(lockFile);
    } catch {
      /* déjà libéré */
    }
  };
  process.once("exit", release);
  return release;
}

async function open(): Promise<DB> {
  if (databaseDriver() === "pg") {
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DATABASE_POOL_MAX || 5),
      ssl: /sslmode=require|neon\.tech/.test(process.env.DATABASE_URL || "") ? { rejectUnauthorized: true } : undefined,
    });
    holder.driver = "pg";
    holder.close = async () => pool.end();
    return drizzlePg(pool, { schema });
  }
  const dir = pgliteDir();
  const release = acquireLock(dir);
  const { PGlite } = await import("@electric-sql/pglite");
  const { pg_trgm } = await import("@electric-sql/pglite/contrib/pg_trgm");
  const { drizzle: drizzleLite } = await import("drizzle-orm/pglite");
  const client = await PGlite.create(dir, { extensions: { pg_trgm } });
  holder.driver = "pglite";
  holder.close = async () => {
    await client.close();
    release();
  };
  return drizzleLite(client, { schema }) as unknown as DB;
}

/** Retourne l'instance Drizzle (ouverture paresseuse, singleton par processus). */
export async function getDb(): Promise<DB> {
  if (holder.db) return holder.db;
  holder.ready ??= open().then((db) => {
    holder.db = db;
    return db;
  });
  return holder.ready;
}

export async function closeDb() {
  if (holder.close) await holder.close();
  holder.db = undefined;
  holder.ready = undefined;
  holder.close = undefined;
}

/** Lignes d'un db.execute(), quel que soit le pilote. */
export function rows<T>(result: unknown): T[] {
  return ((result as { rows?: T[] }).rows ?? []) as T[];
}

export { schema };
