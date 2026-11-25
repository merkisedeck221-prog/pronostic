import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createE2eFixture, deleteE2eFixture, deleteUserByEmail, login, price, service, trackConsoleErrors, type E2eFixture } from "./helpers";

/**
 * Parcours complet (définition du MVP terminé) : inscription → connexion →
 * fiche match → refus faute de solde → recharge simulée → déblocage d'un
 * marché → match complet à prix réduit → portefeuille → résolution → Mes pronostics.
 */

const email = `e2e-${randomUUID()}@example.com`;
const password = `E2e-${randomUUID()}`;
let fx: E2eFixture;

test.beforeAll(async () => {
  fx = await createE2eFixture();
});

test.afterAll(async () => {
  await deleteUserByEmail(email);
  await deleteE2eFixture(fx);
});

test("parcours utilisateur complet", async ({ page }) => {
  const consoleErrors = trackConsoleErrors(page);
  page.on("dialog", (dialog) => dialog.accept());
  const exactPrice = await price("market", "EXACT_SCORE");
  const bundlePrice = await price("match_bundle");
  const { data: pack } = await service.from("credit_packs").select("name, credits").eq("is_active", true).order("sort_order").limit(1).single();
  // Packs fixes PRONEX : le pack crédite exactement ses crédits (aucun bonus).
  const packTotal = pack!.credits;

  // 1. Inscription
  await page.goto("/inscription");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByLabel("Confirmation du mot de passe").fill(password);
  await page.getByLabel("Nom d'affichage").fill("Awa E2E");
  await page.getByText("J'ai 18 ans ou plus").click();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByText("vous allez recevoir un e-mail de confirmation", { exact: false })).toBeVisible();

  // Confirmation de l'e-mail contournée par le client admin (test uniquement).
  const { data: users } = await service.auth.admin.listUsers({ perPage: 1000 });
  const user = users.users.find((u) => u.email === email);
  expect(user, "compte créé").toBeTruthy();
  await service.auth.admin.updateUserById(user!.id, { email_confirm: true });
  const { data: profile } = await service.from("profiles").select("display_name, terms_accepted_at").eq("id", user!.id).single();
  expect(profile?.display_name).toBe("Awa E2E");
  expect(profile?.terms_accepted_at).not.toBeNull();

  // 2. Connexion et navigation jusqu'à la fiche match
  await login(page, email, password);
  await page.goto("/matchs");
  await page.getByRole("link", { name: new RegExp(fx.home) }).first().click();
  await expect(page).toHaveURL(new RegExp(`/matchs/${fx.fixtureId}$`));
  await expect(page.getByRole("heading", { name: fx.home })).toBeVisible();
  await expect(page.getByText("Pronostics IA")).toBeVisible();
  // Aucun contenu payant avant déblocage.
  await expect(page.getByText(`${fx.home} 2 – 1 ${fx.away}`)).toHaveCount(0);

  // 3. Refus faute de solde → Recharger
  const exactCard = page.locator("div.rounded-md", { has: page.getByRole("heading", { name: "Score exact" }) });
  await exactCard.getByRole("button", { name: "Débloquer" }).click();
  await expect(page.getByText("Solde insuffisant")).toBeVisible();
  await page.getByRole("link", { name: "Recharger" }).click();
  await expect(page).toHaveURL(new RegExp(`/recharger\\?next=%2Fmatchs%2F${fx.fixtureId}`));

  // 4. Recharge simulée
  await expect(page.getByText("Paiement de test")).toBeVisible();
  await expect(page.getByText(/bonus|offert/i)).toHaveCount(0);
  const packCard = page.locator("article", { hasText: pack!.name }).first();
  await packCard.getByRole("button", { name: `Acheter ${pack!.credits} crédits` }).click();
  await expect(page).toHaveURL(/\/recharger\/paiement-simule\//);
  await page.getByRole("button", { name: "Simuler un paiement réussi" }).click();
  await expect(page.getByRole("heading", { name: "Recharge réussie" })).toBeVisible();
  await page.getByRole("link", { name: "Retour au match" }).click();
  await expect(page).toHaveURL(new RegExp(`/matchs/${fx.fixtureId}$`));

  // 5. Déblocage d'un marché
  await exactCard.getByRole("button", { name: "Débloquer" }).click();
  await expect(page.getByText(`${packTotal - exactPrice} crédits`).first()).toBeVisible(); // solde après
  await page.getByRole("button", { name: /^Confirmer/ }).click();
  await expect(page.getByText(`${fx.home} 2 – 1 ${fx.away}`)).toBeVisible();

  // 6. Match complet à prix réduit (déduction de ce qui a déjà été payé)
  const reduced = Math.max(bundlePrice - exactPrice, 0);
  await page.getByRole("button", { name: `Débloquer le match complet (${reduced} crédit${reduced > 1 ? "s" : ""})` }).click();
  await page.getByRole("button", { name: /^Confirmer/ }).click();
  await expect(page.getByText("Plus de 2,5 buts")).toBeVisible();
  await expect(page.getByText("Analyse du match")).toBeVisible();
  const finalBalance = packTotal - exactPrice - reduced;

  // 7. Portefeuille
  await page.goto("/portefeuille");
  await expect(page.getByText(`${finalBalance} crédits`).first()).toBeVisible();
  await expect(page.getByText(/Recharge : pack/)).toBeVisible();
  await expect(page.getByText(/Score exact/)).toBeVisible();
  await expect(page.getByText(/match complet/)).toBeVisible();

  // 8. Résolution simulée du match (2-1 au temps réglementaire)
  await service
    .from("fixtures")
    .update({ status_short: "FT", kickoff_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(), ft_home: 2, ft_away: 1, goals_home: 2, goals_away: 1 })
    .eq("id", fx.fixtureId);
  const { data: settled } = await service.rpc("settle_fixture", { p_fixture_id: fx.fixtureId });
  expect(settled).toMatchObject({ ok: true, settled: 4 });

  // 9. Mes pronostics
  await page.goto("/mes-pronostics?filtre=termines");
  await expect(page.getByText(`${fx.home} – ${fx.away}`).first()).toBeVisible();
  await expect(page.getByText("Gagné").first()).toBeVisible();
  await expect(page.getByText("Score final : 2 – 1").first()).toBeVisible();
  await expect(page.getByText("100 %")).toBeVisible();

  expect(consoleErrors, "erreurs dans la console du navigateur").toEqual([]);
});
