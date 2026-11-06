import { describe, expect, it } from "vitest";
import { PRODUCTION_URL, resolveSiteUrl } from "@/config/site";
import { splitBrandName } from "@/components/brand/logo";
import { MARK_PATH } from "@/components/brand/mark-path";
import { markPath } from "../../scripts/brand/geometry";

describe("marque GearMuse", () => {
  it("coupe le nom à la deuxième majuscule pour le logotype", () => {
    expect(splitBrandName("GearMuse")).toEqual(["Gear", "Muse"]);
    expect(splitBrandName("Velo")).toEqual(["Velo", ""]);
  });

  it("le tracé figé du symbole correspond à la géométrie (relancer npm run brand:generate sinon)", () => {
    expect(MARK_PATH).toBe(markPath());
    expect(markPath("small")).not.toBe(markPath());
  });
});

describe("URL canonique", () => {
  it("utilise gearmuse.tv par défaut en production", () => {
    expect(PRODUCTION_URL).toBe("https://gearmuse.tv");
    expect(resolveSiteUrl({ NODE_ENV: "production" })).toBe("https://gearmuse.tv");
  });

  it("reste locale en développement et respecte NEXT_PUBLIC_SITE_URL", () => {
    expect(resolveSiteUrl({ NODE_ENV: "development" })).toBe("http://localhost:3000");
    expect(resolveSiteUrl({ NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://gearmuse.tv/" })).toBe("https://gearmuse.tv");
    expect(resolveSiteUrl({ NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://staging.gearmuse.tv" })).toBe("https://staging.gearmuse.tv");
  });
});
