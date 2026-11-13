import { describe, expect, it } from "vitest";
import { affiliateEnabled, affiliateIds, affiliateLinks, affiliateQuery } from "@/lib/affiliates";

const env = { AFFILIATE_AMAZON_TAG: "gearmuse-21", AFFILIATE_EBAY_CAMPAIGN_ID: "5339000000" };

describe("liens affiliés", () => {
  it("n'affiche rien sans identifiant", () => {
    expect(affiliateEnabled({})).toBe(false);
    expect(affiliateLinks({ name: "Porsche 911" }, {})).toEqual([]);
    expect(affiliateLinks({ name: "Porsche 911" }, { AFFILIATE_AMAZON_TAG: "  ", AFFILIATE_EBAY_CAMPAIGN_ID: "" })).toEqual([]);
  });

  it("écarte un identifiant mal formé au lieu de l'injecter dans une adresse", () => {
    expect(affiliateIds({ AFFILIATE_AMAZON_TAG: "tag&ref=x", AFFILIATE_EBAY_CAMPAIGN_ID: "12ab" })).toEqual({});
    expect(affiliateIds({ AFFILIATE_AMAZON_TAG: " gearmuse-21 ", AFFILIATE_EBAY_CAMPAIGN_ID: "12ab" })).toEqual({ amazon: "gearmuse-21" });
  });

  it("n'active que les programmes renseignés", () => {
    const links = affiliateLinks({ name: "Porsche 911", universes: ["automobile"] }, { AFFILIATE_EBAY_CAMPAIGN_ID: "5339000000" });
    expect(links.map((l) => l.program)).toEqual(["ebay"]);
  });

  it("ajoute la marque à la recherche sans la répéter", () => {
    expect(affiliateQuery({ name: "Porsche 911", brand: "Porsche" })).toBe("Porsche 911");
    expect(affiliateQuery({ name: "CB750", brand: "Honda" })).toBe("Honda CB750");
    expect(affiliateQuery({ name: "  Citroën   DS " })).toBe("Citroën DS");
  });

  it("propose des pièces pour l'automobile et la moto, des objets de collection ailleurs", () => {
    expect(affiliateLinks({ name: "Honda CB750", universes: ["moto"] }, env).map((l) => l.kind)).toEqual(["scale", "books", "parts"]);
    expect(affiliateLinks({ name: "Concorde", universes: ["aviation"] }, env).map((l) => l.kind)).toEqual(["scale", "books", "collectibles"]);
    // Marque présente dans plusieurs univers : offres génériques.
    expect(affiliateLinks({ name: "BMW", universes: ["automobile", "moto"] }, env).map((l) => l.kind)).toEqual(["scale", "books", "collectibles"]);
  });

  it("construit des adresses de recherche encodées, avec l'identifiant", () => {
    const [scale, books, parts] = affiliateLinks({ name: "Citroën DS", universes: ["automobile"] }, env).map((l) => new URL(l.href));
    expect(scale.origin + scale.pathname).toBe("https://www.amazon.fr/s");
    expect(scale.searchParams.get("k")).toBe("Citroën DS miniature");
    expect(scale.searchParams.get("tag")).toBe("gearmuse-21");
    expect(books.searchParams.get("k")).toBe("Citroën DS livre");
    expect(parts.origin + parts.pathname).toBe("https://www.ebay.fr/sch/i.html");
    expect(parts.searchParams.get("_nkw")).toBe("Citroën DS pièces");
    expect(parts.searchParams.get("campid")).toBe("5339000000");
    expect(parts.searchParams.get("mkevt")).toBe("1");
  });
});
