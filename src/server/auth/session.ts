import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { adminSessions, adminUsers, auditLogs, type AdminRole } from "@/db/schema";
import { verifyPassword } from "./password";

/**
 * Sessions administrateur : jeton aléatoire de 256 bits dans un cookie httpOnly,
 * SameSite=Strict, Secure en production ; seule son empreinte SHA-256 est stockée.
 * Les actions serveur de Next.js vérifient en plus l'origine des requêtes (anti-CSRF).
 */
export const SESSION_COOKIE = "vc_admin";
const SESSION_HOURS = 12;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

const ROLE_RANK: Record<AdminRole, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 };
export const can = (role: AdminRole, min: AdminRole) => ROLE_RANK[role] >= ROLE_RANK[min];

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

async function requestMeta() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
  const salt = process.env.IP_HASH_SALT || process.env.SESSION_SECRET || "vehicult";
  return { ipHash: sha(`${salt}:${ip}`).slice(0, 32), userAgent: (h.get("user-agent") ?? "").slice(0, 300) };
}

export type AdminSession = { userId: number; email: string; name: string; role: AdminRole };

export async function login(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = await getDb();
  const user = await db.query.adminUsers.findFirst({ where: eq(adminUsers.email, email.trim().toLowerCase()) });
  const generic = { ok: false as const, error: "Identifiants invalides." };
  if (!user || !user.isActive) {
    await verifyPassword(password, "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA"); // temps constant approximatif
    return generic;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) return { ok: false, error: `Compte temporairement verrouillé après plusieurs échecs. Réessayez après ${user.lockedUntil.toLocaleTimeString("fr-FR")}.` };
  const meta = await requestMeta();
  if (!(await verifyPassword(password, user.passwordHash))) {
    const failed = user.failedAttempts + 1;
    await db
      .update(adminUsers)
      .set({ failedAttempts: failed >= MAX_FAILED ? 0 : failed, lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60e3) : null })
      .where(eq(adminUsers.id, user.id));
    await db.insert(auditLogs).values({ adminUserId: user.id, actor: user.email, action: "login_failed", ipHash: meta.ipHash });
    return generic;
  }
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600e3);
  await db.insert(adminSessions).values({ id: sha(token), userId: user.id, expiresAt, ipHash: meta.ipHash, userAgent: meta.userAgent });
  await db.update(adminUsers).set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(adminUsers.id, user.id));
  await db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date()));
  await db.insert(auditLogs).values({ adminUserId: user.id, actor: user.email, action: "login", ipHash: meta.ipHash });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && !process.env.ALLOW_INSECURE_COOKIES,
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
  });
  return { ok: true };
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(adminSessions).where(eq(adminSessions.id, sha(token)));
  }
  jar.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<AdminSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const db = await getDb();
  const s = await db.query.adminSessions.findFirst({ where: and(eq(adminSessions.id, sha(token)), gt(adminSessions.expiresAt, new Date())) });
  if (!s) return null;
  const u = await db.query.adminUsers.findFirst({ where: eq(adminUsers.id, s.userId) });
  if (!u || !u.isActive) return null;
  return { userId: u.id, email: u.email, name: u.name, role: u.role };
}

/** À appeler en tête de chaque page et action d'administration. */
export async function requireAdmin(min: AdminRole = "viewer"): Promise<AdminSession> {
  const s = await getSession();
  if (!s) redirect("/admin/connexion");
  if (!can(s.role, min)) throw new Error("Permission insuffisante pour cette action");
  return s;
}

export async function audit(session: AdminSession | null, action: string, entityType?: string, entityId?: string | number, before?: unknown, after?: unknown) {
  const db = await getDb();
  const meta = await requestMeta().catch(() => ({ ipHash: null }));
  await db.insert(auditLogs).values({ adminUserId: session?.userId ?? null, actor: session?.email ?? "system", action, entityType, entityId: entityId != null ? String(entityId) : null, before: before ?? null, after: after ?? null, ipHash: meta.ipHash });
}
