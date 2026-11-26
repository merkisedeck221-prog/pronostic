import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createE2eFixture, deleteE2eFixture, deleteUserByEmail, login, service, trackConsoleErrors, type E2eFixture } from "./helpers";

/** Parcours admin : changement de prix, ajustement de solde, masquage d'un marché (tous journalisés). */

const adminEmail = `e2e-admin-${randomUUID()}@example.com`;
const userEmail = `e2e-joueur-${randomUUID()}@example.com`;
const password = `E2e-${randomUUID()}`;
let fx: E2eFixture;
let adminId: string;
let userId: string;
let originalBttsPrice: number;

test.beforeAll(async () => {
  fx = await createE2eFixture();
  const admin = await service.auth.admin.createUser({ email: adminEmail, password, email_confirm: true, user_metadata: { display_name: "Admin E2E" } });
  adminId = admin.data.user!.id;
  await service.from("profiles").update({ role: "admin" }).eq("id", adminId);
  const user = await service.auth.admin.createUser({ email: userEmail, password, email_confirm: true, user_metadata: { display_name: "Joueur E2E" } });
  userId = user.data.user!.id;
  const { data } = await service.from("pricing_rules").select("credits").eq("scope", "market").eq("market_code", "BTTS").is("competition_id", null).single();
  originalBttsPrice = data!.credits;
});

test.afterAll(async () => {
  await service.from("pricing_rules").update({ credits: originalBttsPrice }).eq("scope", "market").eq("market_code", "BTTS").is("competition_id", null);
  await service.from("admin_audit_log").delete().eq("admin_id", adminId);
  await deleteUserByEmail(userEmail);
  await deleteUserByEmail(adminEmail);
  await deleteE2eFixture(fx);
});

test("parcours administrateur", async ({ page }) => {
  const consoleErrors = trackConsoleErrors(page);
  page.on("dialog", (dialog) => dialog.accept());
  await login(page, adminEmail, password);

  // Changement de prix
  const newPrice = originalBttsPrice + 1;
  await page.goto("/admin/tarifs");
  const bttsRow = page.locator("form", { hasText: "Les deux équipes marquent" }).first();
  await bttsRow.getByLabel("Prix Les deux équipes marquent").fill(String(newPrice));
  await bttsRow.getByRole("button", { name: "Enregistrer" }).click();
  await expect(bttsRow.getByText("Prix enregistré.")).toBeVisible();

  // Ajustement de solde
  await page.goto(`/admin/utilisateurs?q=${encodeURIComponent(userEmail)}`);
  await page.getByRole("link", { name: "Joueur E2E" }).click();
  await page.getByLabel("Montant (+ crédit, − débit)").fill("5");
  await page.getByLabel("Motif (obligatoire)").first().fill("Geste commercial E2E");
  await page.getByRole("button", { name: "Ajuster" }).click();
  await expect(page.getByText("Solde ajusté : nouveau solde 5 crédits.")).toBeVisible();

  // Masquage d'un marché
  await page.goto(`/admin/matchs/${fx.fixtureId}`);
  const bttsBlock = page.locator("div.rounded-xl", { hasText: "Les deux équipes marquent" }).filter({ has: page.getByRole("button", { name: "Masquer ce marché" }) }).first();
  await bttsBlock.getByRole("button", { name: "Masquer ce marché" }).click();
  await expect(bttsBlock.getByText(/Marché masqué/)).toBeVisible();

  // Effets et journal d'audit
  const { data: rule } = await service.from("pricing_rules").select("credits").eq("scope", "market").eq("market_code", "BTTS").is("competition_id", null).single();
  expect(rule?.credits).toBe(newPrice);
  const { data: wallet } = await service.from("wallets").select("balance").eq("user_id", userId).single();
  expect(wallet?.balance).toBe(5);
  const { data: hidden } = await service.from("predictions").select("status").eq("fixture_id", fx.fixtureId).eq("market_code", "BTTS").single();
  expect(hidden?.status).toBe("hidden");
  const { data: log } = await service.from("admin_audit_log").select("action").eq("admin_id", adminId);
  expect((log ?? []).map((l) => l.action)).toEqual(expect.arrayContaining(["update_price", "adjust_balance", "hide_prediction"]));

  // Le marché masqué n'est plus proposé sur la fiche publique.
  await page.goto(`/matchs/${fx.fixtureId}`);
  await expect(page.getByRole("heading", { name: "Les deux équipes marquent" })).toHaveCount(0);

  expect(consoleErrors, "erreurs dans la console du navigateur").toEqual([]);
});
