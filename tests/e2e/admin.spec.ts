import { expect, test } from "@playwright/test";

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

test.describe("Administration", () => {
  test("les pages d'administration exigent une session", async ({ page }) => {
    await page.goto("/admin/moderation");
    await expect(page).toHaveURL(/\/admin\/connexion/);
  });

  test("mauvais mot de passe refusé", async ({ page }) => {
    await page.goto("/admin/connexion");
    await page.getByLabel("E-mail").fill("inconnu@example.test");
    await page.getByLabel("Mot de passe").fill("mauvais-mot-de-passe");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText("Identifiants invalides")).toBeVisible();
  });

  test("connexion, tableau de bord, modération et fiche vidéo", async ({ page }) => {
    test.skip(!email || !password, "ADMIN_EMAIL / ADMIN_PASSWORD non définis");
    // Parcourt neuf pages : en développement, chacune est compilée à la première visite.
    test.setTimeout(180_000);
    await page.goto("/admin/connexion");
    await page.getByLabel("E-mail").fill(email!);
    await page.getByLabel("Mot de passe").fill(password!);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
    await expect(page.getByText("Couverture du catalogue par univers")).toBeVisible();

    await page.getByRole("link", { name: "File de modération" }).click();
    await expect(page.getByRole("heading", { name: "File de modération" })).toBeVisible();

    await page.goto("/admin/videos?statut=published");
    await page.locator("table a[href^='/admin/videos/']").first().click();
    await expect(page.getByText("Décision éditoriale")).toBeVisible();
    await expect(page.getByText(/Preuves de recommandation/)).toBeVisible();

    for (const path of ["/admin/import", "/admin/playlists", "/admin/taxonomie", "/admin/sources", "/admin/taches", "/admin/ia", "/admin/reglages", "/admin/journal", "/admin/comptes"]) {
      await page.goto(path);
      await expect(page.locator("main h1")).toBeVisible();
    }
    await page.getByRole("button", { name: "Déconnexion" }).click();
    await expect(page).toHaveURL(/\/admin\/connexion/);
  });
});
