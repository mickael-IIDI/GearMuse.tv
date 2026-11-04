import { describe, expect, it } from "vitest";
import { editDistance, extractYouTubeIds, formatDuration, guessLanguage, idFromVideoSlug, normalize, parseIsoDuration, parseYouTubeId, slugify, videoSlug } from "@/lib/text";

describe("normalisation", () => {
  it("retire accents, ponctuation et casse", () => {
    expect(normalize("Restauration d'une Porsche 911 — « Élégance » !")).toBe("restauration d une porsche 911 elegance");
  });
  it("produit des slugs lisibles", () => {
    expect(slugify("Cockpit Airbus A350 : décollage à Toulouse")).toBe("cockpit-airbus-a350-decollage-a-toulouse");
  });
});

describe("identifiants YouTube", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?t=42", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("extrait l'identifiant de %s", (url, id) => {
    expect(parseYouTubeId(url)).toBe(id);
  });
  it("rejette les URL étrangères ou malformées", () => {
    expect(parseYouTubeId("https://vimeo.com/123456")).toBeNull();
    expect(parseYouTubeId("https://www.youtube.com/watch?v=trop-court")).toBeNull();
    expect(parseYouTubeId("pas une url")).toBeNull();
  });
  it("trouve tous les identifiants dans un commentaire HTML", () => {
    const html = 'Voir <a href="https://www.youtube.com/watch?v=aaaaaaaaaaa">ici</a> et https://youtu.be/bbbbbbbbbbb, ou https://www.youtube.com/watch?t=3&amp;v=ccccccccccc';
    expect(extractYouTubeIds(html).sort()).toEqual(["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc"]);
  });
  it("aller-retour slug ↔ identifiant", () => {
    const slug = videoSlug("How a Jet Engine Works", "a-b_c1234XY");
    expect(slug).toBe("how-a-jet-engine-works-a-b_c1234XY");
    expect(idFromVideoSlug(slug)).toBe("a-b_c1234XY");
  });
});

describe("durées et divers", () => {
  it("convertit les durées ISO 8601", () => {
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(parseIsoDuration("PT45S")).toBe(45);
    expect(parseIsoDuration("P1DT1H")).toBe(90000);
    expect(parseIsoDuration(null)).toBeNull();
  });
  it("formate les durées", () => {
    expect(formatDuration(3723)).toBe("1:02:03");
    expect(formatDuration(65)).toBe("1:05");
  });
  it("calcule une distance d'édition avec transposition", () => {
    expect(editDistance("reactoin", "reaction")).toBe(1);
    expect(editDistance("porshe", "porsche")).toBe(1);
    expect(editDistance("avion", "bateau", 2)).toBeGreaterThan(2);
  });
  it("devine la langue sur des titres explicites", () => {
    expect(guessLanguage("Comment fonctionne le moteur d'une voiture électrique")).toBe("fr");
    expect(guessLanguage("How the engine of this car works")).toBe("en");
  });
});
