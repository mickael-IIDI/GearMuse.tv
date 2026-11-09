import { expect, test } from "@playwright/test";

test.describe("Parcours visiteur", () => {
  test("accueil : sections, compteurs réels et cartes vidéo", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("médiathèque");
    await expect(page.getByText(/vidéos publiées et vérifiées/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sélection du moment" })).toBeVisible();
    const cards = page.locator("article");
    expect(await cards.count()).toBeGreaterThan(8);
    // Miniatures officielles YouTube uniquement
    const src = await page.locator("article img").first().getAttribute("src");
    expect(src).toMatch(/^https:\/\/i\d?\.ytimg\.com\//);
  });

  test("navigation latérale vers un univers, sous-catégories et filtres combinables dans l'URL", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Aviation" }).click();
    await page.waitForURL(/\/univers\/aviation$/, { timeout: 60_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Aviation" })).toBeVisible();
    await page.getByRole("button", { name: /Filtres/ }).click();
    await page.getByRole("button", { name: "Documentaire" }).click();
    await expect(page).toHaveURL(/format=documentaire/);
    await page.getByRole("button", { name: /Filtres/ }).click();
    await page.getByRole("button", { name: "Les plus recommandées" }).click();
    await expect(page).toHaveURL(/format=documentaire.*tri=recommandation|tri=recommandation.*format=documentaire/);
    // Le filtre actif s'affiche en pastille et se retire d'un clic
    await page.getByRole("button", { name: /Retirer le filtre Documentaire/ }).click();
    await expect(page).not.toHaveURL(/format=documentaire/);
  });

  test("langue des vidéos : choisie sur l'accueil, appliquée aux listes, modifiable dans les paramètres", async ({ page }) => {
    await page.goto("/");
    const picker = page.getByRole("combobox", { name: "Langue des vidéos" });
    await expect(picker).toBeVisible();
    // Un clic n'importe où sur la pastille ouvre la liste, pas seulement sur le texte.
    const coversPill = await picker.evaluate((select) => {
      const box = select.closest("label")!.getBoundingClientRect();
      return [box.left + 14, box.left + box.width / 2, box.right - 12].every((x) => document.elementFromPoint(x, box.top + box.height / 2) === select);
    });
    expect(coversPill).toBe(true);
    // Première langue proposée (dépend du catalogue) et nombre de vidéos annoncé.
    const option = picker.locator("option").nth(1);
    const code = (await option.getAttribute("value")) ?? "";
    const announced = ((await option.textContent()) ?? "").match(/\(([^)]*)\)\s*$/)?.[1].replace(/\D/g, "");
    expect(code).toMatch(/^[a-z]{2,3}$/);
    await picker.selectOption(code);
    await expect(picker).toHaveValue(code);
    await expect(picker).toBeEnabled({ timeout: 30_000 });

    await page.goto("/videos");
    await expect(picker).toHaveValue(code);
    const total = page.locator("#contenu header p").filter({ hasText: /vidéos?$/ }).first();
    await expect.poll(async () => ((await total.textContent()) ?? "").replace(/\D/g, "")).toBe(announced);

    await page.goto("/parametres");
    const settings = page.getByRole("radiogroup", { name: "Langue des vidéos" });
    await expect(settings.getByRole("radio", { checked: true })).not.toContainText("Toutes les langues");
    await settings.getByRole("radio", { name: /Toutes les langues/ }).click();
    await expect(settings.getByRole("radio", { checked: true })).toContainText("Toutes les langues");

    await page.goto("/videos");
    await expect(picker).toHaveValue("");
  });

  test("sous-catégorie active : le texte du filtre reste lisible dans les deux thèmes", async ({ page }) => {
    await page.goto("/categories");
    await page.locator('a[href^="/univers/aviation/"]').first().click();
    await page.waitForURL(/\/univers\/aviation\/.+/, { timeout: 60_000 });
    const chip = page.locator('#contenu a[aria-current="page"]').first();
    await expect(chip).toBeVisible();
    const luminance = (rgb: string) => {
      const [r, g, b] = (rgb.match(/[\d.]+/g) ?? []).map(Number).map((c) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    for (const theme of ["dark", "light"]) {
      await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
      const { color, background } = await chip.evaluate((el) => {
        const s = getComputedStyle(el);
        return { color: s.color, background: s.backgroundColor };
      });
      const [hi, lo] = [luminance(color), luminance(background)].sort((a, b) => b - a);
      expect((hi + 0.05) / (lo + 0.05), `${theme} : ${color} sur ${background}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("recherche en langage naturel, correction orthographique et résultats vides", async ({ page }) => {
    await page.goto("/recherche?q=comment%20fonctionne%20un%20moteur%20a%20reactoin");
    await expect(page.getByText("Essayez avec :")).toBeVisible();
    await expect(page.locator("article").first()).toBeVisible();
    await page.goto("/recherche?q=xqzwv%20plorf");
    await expect(page.getByText(/Aucune vidéo ne correspond/).first()).toBeVisible();
  });

  test("autocomplétion depuis la barre de recherche", async ({ page }) => {
    await page.goto("/");
    const box = page.getByRole("combobox", { name: "Rechercher" });
    await box.fill("boein");
    await expect(page.getByRole("listbox")).toBeVisible();
    await expect(page.getByRole("listbox").getByRole("option").first()).toBeVisible();
    await box.press("Enter");
    await expect(page).toHaveURL(/\/recherche\?q=boein/);
  });

  test("page vidéo : lecteur au clic, justification, favoris, historique, plus tard", async ({ page }) => {
    await page.goto("/mieux-notees");
    const first = page.locator("article h3 a").first();
    const title = (await first.textContent())?.trim() ?? "";
    await first.click();
    await expect(page).toHaveURL(/\/video\//);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(page.getByText("Pourquoi cette vidéo a été sélectionnée")).toBeVisible();
    await expect(page.getByRole("button", { name: /Lire la vidéo/ })).toBeVisible();
    // Données structurées présentes
    expect(await page.locator('script[type="application/ld+json"]').first().textContent()).toContain("BreadcrumbList");

    await page.getByRole("button", { name: "Ajouter aux favoris", exact: true }).first().click();
    await expect(page.getByRole("button", { name: "Dans vos favoris", exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Regarder plus tard", exact: true }).first().click();

    await page.goto("/favoris");
    await expect(page.locator("article h3").filter({ hasText: title })).toBeVisible();
    await page.goto("/a-regarder");
    await expect(page.locator("article h3").filter({ hasText: title })).toBeVisible();
    await page.goto("/historique");
    await expect(page.locator("article h3").filter({ hasText: title })).toBeVisible();
    await page.getByRole("button", { name: "Effacer l'historique" }).click();
    await expect(page.getByText("Aucune vidéo consultée")).toBeVisible();

    // Recommandations personnalisées et expliquées à partir du favori
    await page.goto("/pour-vous");
    await expect(page.locator("article").first()).toBeVisible();
    await expect(page.getByText(/Recommandée car|Parce que|Autour de|De .*chaîne|Pour votre intérêt|Une découverte/).first()).toBeVisible();
  });

  test("paramètres : thème clair et langue anglaise conservés", async ({ page }) => {
    await page.goto("/parametres");
    await page.getByRole("radio", { name: "Clair" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("radio", { name: "English" }).click();
    await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Home" })).toBeVisible();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.getByRole("radio", { name: "Français" }).click();
    await expect(page.getByRole("navigation", { name: "Navigation principale" })).toBeVisible();
  });

  test("playlists et catégories", async ({ page }) => {
    await page.goto("/categories");
    await expect(page.getByRole("heading", { name: "Automobile" })).toBeVisible();
    await page.goto("/playlists");
    const pl = page.locator("main a[href^='/playlists/']").first();
    if (await pl.count()) {
      await pl.click();
      await expect(page.locator("ol li").first()).toBeVisible();
    }
  });

  test("signalement d'un contenu", async ({ page }) => {
    await page.goto("/signaler");
    await page.getByLabel("Motif").selectOption("wrong_category");
    await page.getByLabel("Message").fill("Test automatisé : vérification du formulaire de signalement.");
    await page.getByRole("button", { name: "Envoyer le signalement" }).click();
    await expect(page.getByRole("status")).toContainText("Merci");
  });

  test("SEO technique et gestion des erreurs", async ({ page, request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /admin");
    expect(robots).toContain("Sitemap:");
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/video/");
    expect(sitemap).toContain("/univers/aviation");
    expect((await request.get("/video/inexistante-AAAAAAAAAAA")).status()).toBe(404);
    expect((await request.get("/api/cron/daily")).status()).toBe(401);
    await page.goto("/videos");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/videos$/);
  });
});
