import { afterEach, describe, expect, it, vi } from "vitest";
import { closeDb, DatabaseConfigError, getDb } from "@/db/client";

afterEach(async () => {
  await closeDb();
  vi.unstubAllEnvs();
});

describe("base de données sur Vercel", () => {
  it("refuse la base locale sans DATABASE_URL, avec un message explicite", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("DATABASE_URL", "");
    await expect(getDb()).rejects.toBeInstanceOf(DatabaseConfigError);
    await expect(getDb()).rejects.toThrow(/DATABASE_URL absente ou invalide/);
  });

  it("refuse aussi une adresse qui n'est pas une URL PostgreSQL", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("DATABASE_URL", "neondb");
    await expect(getDb()).rejects.toBeInstanceOf(DatabaseConfigError);
  });
});
