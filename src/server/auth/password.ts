import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;

/** Hachage scrypt (paramètres OWASP) au format scrypt$N$r$p$sel$empreinte. */
const N = 2 ** 15;
const R = 8;
const P = 1;

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12) throw new Error("Le mot de passe doit contenir au moins 12 caractères");
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, 64, { N, r: R, p: P, maxmem: 128 * N * R * 2 });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, saltB64, hashB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const got = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: 128 * Number(n) * Number(r) * 2 });
  return got.length === expected.length && timingSafeEqual(got, expected);
}
