import { describe, expect, it } from "vitest";
// @ts-expect-error -- module interne de pg, sans déclaration de types
import { prepareValue } from "pg/lib/utils";
import { prepare } from "../../scripts/transfer-db";

// Ce que node-postgres (pilote de Neon) enverra réellement au serveur pour chaque valeur préparée.
const wire = (v: unknown, dataType: string) => prepareValue(prepare(v, { dataType }));

describe("copie vers PostgreSQL : préparation des valeurs", () => {
  it("envoie le JSON sérialisé, y compris un tableau JSON (sinon pris pour un tableau PostgreSQL)", () => {
    expect(wire(["moteur", "essai"], "jsonb")).toBe('["moteur","essai"]');
    expect(wire({ fr: "Moto", en: "Motorcycles" }, "jsonb")).toBe('{"fr":"Moto","en":"Motorcycles"}');
    expect(wire("texte", "json")).toBe('"texte"');
  });

  it("garde les tableaux PostgreSQL, les dates et les grands entiers", () => {
    expect(wire(["a", "b,c"], "ARRAY")).toBe('{"a","b,c"}');
    expect(wire(new Date("2026-11-10T00:00:00Z"), "date")).toBe("2026-11-10");
    expect(wire(BigInt("12345678901234567890"), "bigint")).toBe("12345678901234567890");
    expect(prepare(null, { dataType: "jsonb" })).toBeNull();
  });

  it("transmet un horodatage avec son fuseau, sans perte", () => {
    const d = new Date("2026-11-09T17:52:12.345Z");
    expect(new Date(String(wire(d, "timestamp with time zone"))).getTime()).toBe(d.getTime());
  });
});
