import { describe, expect, it } from "vitest";
import { parseFilters } from "@/lib/filters";
import { buildLanguageOptions, isLanguageCode, languageLabel } from "@/lib/languages";

describe("langue des vidéos", () => {
  it("n'accepte que des codes de langue bien formés", () => {
    expect(isLanguageCode("fr")).toBe(true);
    expect(isLanguageCode("zxx")).toBe(true);
    expect(isLanguageCode("autre")).toBe(false);
    expect(isLanguageCode("FR")).toBe(false);
    expect(isLanguageCode("fr'; drop")).toBe(false);
    expect(isLanguageCode(undefined)).toBe(false);
  });

  it("nomme les langues dans la langue de l'interface", () => {
    expect(languageLabel("ja", "fr")).toBe("Japonais");
    expect(languageLabel("ja", "en")).toBe("Japanese");
    expect(languageLabel("zxx", "fr")).toBe("Sans paroles");
  });

  it("place la langue de l'interface en tête, puis les langues les plus fournies", () => {
    const rows = [{ code: "ja", count: 40 }, { code: "en", count: 1693 }, { code: "fr", count: 81 }];
    expect(buildLanguageOptions(rows, "fr").map((o) => o.code)).toEqual(["fr", "en", "ja"]);
    expect(buildLanguageOptions(rows, "en").map((o) => o.code)).toEqual(["en", "fr", "ja"]);
  });

  it("garde la langue active proposée même sans vidéo publiée", () => {
    const options = buildLanguageOptions([{ code: "en", count: 10 }], "fr", "pl");
    expect(options.find((o) => o.code === "pl")).toMatchObject({ count: 0, label: "Polonais" });
  });

  it("transmet la langue par l'URL de l'API et rejette les valeurs invalides", () => {
    expect(parseFilters(new URLSearchParams("langue=ja")).filters.langue).toBe("ja");
    expect(parseFilters(new URLSearchParams("langue=autre")).filters.langue).toBeUndefined();
  });
});
