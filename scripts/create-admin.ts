import "./_env";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { adminUsers, ADMIN_ROLES, type AdminRole } from "@/db/schema";
import { hashPassword } from "@/server/auth/password";

/**
 * Crée ou met à jour un compte administrateur.
 *   npm run admin:create -- <email> <rôle: owner|admin|editor|viewer> [nom]
 * Le mot de passe est lu dans la variable ADMIN_PASSWORD (jamais en argument,
 * pour ne pas apparaître dans l'historique du terminal).
 */
async function main() {
  const [emailArg, roleArg = "owner", ...nameParts] = process.argv.slice(2);
  const email = (emailArg ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const role = roleArg as AdminRole;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || !ADMIN_ROLES.includes(role)) {
    console.error("Usage : ADMIN_PASSWORD=… npm run admin:create -- <email> <owner|admin|editor|viewer> [nom]");
    process.exit(1);
  }
  await runMigrations();
  const db = await getDb();
  const passwordHash = await hashPassword(password);
  const existing = await db.query.adminUsers.findFirst({ where: eq(adminUsers.email, email) });
  if (existing) {
    await db.update(adminUsers).set({ passwordHash, role, isActive: true, failedAttempts: 0, lockedUntil: null, updatedAt: new Date() }).where(eq(adminUsers.id, existing.id));
    console.log(`Compte mis à jour : ${email} (${role})`);
  } else {
    await db.insert(adminUsers).values({ email, role, name: nameParts.join(" ") || email.split("@")[0], passwordHash });
    console.log(`Compte créé : ${email} (${role})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
