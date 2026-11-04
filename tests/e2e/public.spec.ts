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
    await page.getByRole("button", { name: "Anglais" }).click();
    await expect(page).toHaveURL(/langue=en/);
    await page.getByRole("button", { name: /Filtres/ }).click();
    await page.getByRole("button", { name: "Les plus recommandées" }).click();
    await expect(page).toHaveURL(/langue=en.*tri=recommandation|tri=recommandation.*langue=en/);
    // Le filtre actif s'affiche en pastille et se retire d'un clic
    await page.getByRole("button", { name: /Retirer le filtre Anglais/ }).click();
    await expect(page).not.toHaveURL(/langue=en/);
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
    const box = page.getByRole("combobox");
    await box.fill("boein");
    await expect(page.getByRole("listbox")).toBeVisible();
    await expect(page.getByRole("option").first()).toBeVisible();
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
