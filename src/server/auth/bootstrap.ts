import { sql } from "drizzle-orm";
import { getDb, rows } from "@/db/client";
import { adminUsers } from "@/db/schema";
import { hashPassword } from "./password";

/**
 * Crée le premier compte propriétaire à partir de ADMIN_EMAIL / ADMIN_PASSWORD
 * si aucun administrateur n'existe encore. Sans effet ensuite.
 */
export async function ensureBootstrapAdmin(): Promise<boolean> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return false;
  const db = await getDb();
  const n = Number(rows<{ n: number }>(await db.execute(sql`select count(*)::int as n from admin_users`))[0]?.n ?? 0);
  if (n > 0) return false;
  await db.insert(adminUsers).values({ email, name: process.env.ADMIN_NAME || "Administrateur", passwordHash: await hashPassword(password), role: "owner" }).onConflictDoNothing();
  return true;
}
