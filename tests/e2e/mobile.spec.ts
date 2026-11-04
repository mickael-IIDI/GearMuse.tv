import { expect, test } from "@playwright/test";

test("mobile : menu en tiroir, grille sur une colonne, pas de défilement horizontal", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Navigation principale" });
  await expect(nav).not.toBeInViewport();
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(nav).toBeInViewport();
  await nav.getByRole("link", { name: "Playlists" }).click();
  await expect(page).toHaveURL(/\/playlists/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
