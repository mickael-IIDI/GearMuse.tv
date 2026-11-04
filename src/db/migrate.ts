import path from "node:path";
import { sql } from "drizzle-orm";
import { databaseDriver, getDb } from "./client";

/** Applique les migrations SQL du dossier ./drizzle (idempotent). */
export async function runMigrations() {
  const db = await getDb();
  await db.execute(sql`create extension if not exists pg_trgm`);
  const migrationsFolder = path.resolve("./drizzle");
  if (databaseDriver() === "pg") {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    await migrate(db, { migrationsFolder });
  } else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as never, { migrationsFolder });
  }
}
