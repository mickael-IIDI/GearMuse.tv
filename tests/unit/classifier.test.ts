import { describe, expect, it } from "vitest";
import { classify } from "@/lib/taxonomy/classifier";

const c = (title: string, extra: Partial<Parameters<typeof classify>[0]> = {}) => classify({ title, ...extra });

describe("périmètre thématique", () => {
  it.each([
    ["How a Jet Engine Works", "aviation"],
    ["Restauration complète d'une Porsche 911 de 1973", "automobile"],
    ["The World's Largest Container Ship", "nautisme"],
    ["Saturn V Rocket Launch - Apollo 11", "autres-vehicules"],
    ["Kawasaki Ninja H2R top speed run", "moto"],
    ["Riva Aquarama boat restoration", "nautisme"],
  ])("« %s » → %s", (title, universe) => {
    const r = c(title);
    expect(r.inScope).toBe(true);
    expect(r.universes[0].slug).toBe(universe);
  });

  it.each([
    "Building a search engine in Rust",
    "Show HN: I built a game engine",
    "Train a model in 5 minutes",
    "Guy Kawasaki: The Top 10 Mistakes of Entrepreneurs",
    "New Tour of the Minecraft Enterprise starship",
    "Understanding race conditions in Go",
    "Microsoft Flight Simulator - E3 2019 - Announce Trailer",
  ])("écarte les faux positifs : « %s »", (title) => {
    expect(c(title).inScope).toBe(false);
  });

  it("la thématique de la chaîne ne suffit pas sans mot-clé véhicule", () => {
    expect(c("How To Study more EFFECTIVELY! Explained by CAPTAIN JOE", { universeHint: "aviation" }).inScope).toBe(false);
  });

  it("un titre sans véhicule, sauvé par la seule description, voit sa pertinence réduite (validation humaine)", () => {
    const allusive = c("How To Study more EFFECTIVELY! Explained by CAPTAIN JOE", {
      universeHint: "aviation",
      description: "Airline pilot Captain Joe shares how he studied for his ATPL exams and flight training: aircraft systems, aviation theory.",
    });
    expect(allusive.relevance).toBeLessThan(0.55);
    const explicit = c("How does an ALTIMETER work? Explained by CAPTAIN JOE - cockpit instruments", { universeHint: "aviation" });
    expect(explicit.relevance).toBeGreaterThanOrEqual(0.55);
  });

  it("une source spécialisée suffit à confirmer un signal faible", () => {
    expect(c("Inside the engine bay", { universeHint: "automobile" }).inScope).toBe(true);
  });
});

describe("entités et formats", () => {
  it("reconnaît marques et modèles, et exige la marque pour les modèles ambigus", () => {
    const r = c("Essai BMW M3 E46 sur circuit");
    expect(r.brands.map((b) => b.slug)).toContain("bmw");
    expect(r.models.map((m) => m.slug)).toContain("m3-e46");
    expect(c("The 911 emergency call system").models).toHaveLength(0);
  });
  it("détecte les formats, technologies et la temporalité", () => {
    const doc = c("SR-71 Blackbird full documentary");
    expect(doc.formats.map((f) => f.slug)).toContain("documentaire");
    expect(c("Ferrari V12 engine explained").technologies.map((t) => t.slug)).toContain("thermique");
    expect(c("Watch live: Starship flight test").temporality).toBe("news");
    expect(c("How the Lockheed SR-71 Blackbird Works").temporality).toBe("evergreen");
  });
  it("laisse « non mesurable » un critère sans signal plutôt que de le noter bas", () => {
    const r = c("Boeing 747 landing at Kai Tak");
    expect(r.technicalDepth).toBeUndefined();
    expect(c("How a helicopter works").pedagogicalValue).toBeGreaterThan(0.5);
  });
  it("conserve les signaux observés pour l'explicabilité", () => {
    expect(c("Airbus A350 cockpit tour").signals.join(" ")).toMatch(/Titre/);
  });
});
