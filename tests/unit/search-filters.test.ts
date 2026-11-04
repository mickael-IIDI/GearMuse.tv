import { describe, expect, it } from "vitest";
import { filtersToSearchParams, parseFilters } from "@/lib/filters";
import { analyzeQuery } from "@/lib/search/synonyms";
import { sanitize } from "@/components/library/store";

describe("analyse de requête", () => {
  it("détecte les expressions FR/EN et les mots d'intention", () => {
    const terms = analyzeQuery("Comment fonctionne un moteur à réaction ?");
    const jet = terms.find((t) => t.term === "moteur a reaction");
    expect(jet?.alternatives).toContain("jet engine");
    expect(terms.find((t) => t.term === "comment fonctionne")?.modifier).toBe(true);
    expect(jet?.modifier).toBeFalsy();
  });
  it("ignore les mots vides et garde les modèles numériques", () => {
    const terms = analyzeQuery("Essai de la BMW M3 E46").map((t) => t.term);
    expect(terms).toEqual(expect.arrayContaining(["essai", "bmw", "m3", "e46"]));
    expect(terms).not.toContain("de");
    expect(terms).not.toContain("la");
  });
  it("relie les 24 Heures du Mans à leur nom anglais", () => {
    const t = analyzeQuery("Documentaire sur les 24 Heures du Mans").find((x) => x.term === "24 heures du mans");
    expect(t?.alternatives).toContain("le mans");
  });
});

describe("filtres d'URL", () => {
  it("n'accepte que les valeurs connues ou des slugs valides", () => {
    const r = parseFilters({ duree: "long", format: "inconnu", univers: "aviation", marque: "<script>", tri: "date", page: "3", q: "  Porsche  " });
    expect(r.filters).toEqual({ duree: "long", univers: "aviation" });
    expect(r.sort).toBe("date");
    expect(r.page).toBe(3);
    expect(r.q).toBe("Porsche");
  });
  it("sérialise de manière partageable", () => {
    expect(filtersToSearchParams({ duree: "long", univers: "moto" }, { tri: "qualite" }).toString()).toBe("duree=long&univers=moto&tri=qualite");
  });
});

describe("bibliothèque locale", () => {
  it("assainit des données importées malveillantes ou corrompues", () => {
    const s = sanitize({
      favorites: ["dQw4w9WgXcQ", "<img src=x>", "dQw4w9WgXcQ"] as string[],
      history: [{ id: "dQw4w9WgXcQ", at: 1 }, { id: "bad", at: 2 }] as { id: string; at: number }[],
      prefs: { universes: ["aviation"], formats: [], duration: "n'importe" as never, historyEnabled: false, autoLoadPlayer: true },
    });
    expect(s.favorites).toEqual(["dQw4w9WgXcQ"]);
    expect(s.history).toHaveLength(1);
    expect(s.prefs.duration).toBeNull();
    expect(s.prefs.historyEnabled).toBe(false);
  });
});
