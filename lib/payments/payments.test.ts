import { describe, expect, it } from "vitest";
import { deriveMockSecret, signMockPayload, verifyMockSignature } from "./mock-signature";
import { isProductionDeployment, isProviderAllowed } from "./registry";
import { startTopupSchema, topupErrorMessage } from "./schemas";

const SECRET = "s".repeat(40);
const BODY = JSON.stringify({ providerRef: "mock_00000000-0000-4000-8000-000000000000", status: "succeeded" });
const NOW = 1_800_000_000;

describe("signature du paiement simulé", () => {
  it("valide", () => {
    const signature = signMockPayload(SECRET, NOW, BODY);
    expect(signature).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(verifyMockSignature(SECRET, { signature, timestamp: String(NOW) }, BODY, NOW)).toEqual({ ok: true });
  });

  it("absente", () => {
    expect(verifyMockSignature(SECRET, { signature: null, timestamp: String(NOW) }, BODY, NOW)).toEqual({ ok: false, reason: "missing" });
    expect(verifyMockSignature(SECRET, { signature: signMockPayload(SECRET, NOW, BODY), timestamp: null }, BODY, NOW)).toEqual({
      ok: false,
      reason: "missing",
    });
  });

  it("invalide : mauvais secret, corps modifié, horodatage modifié", () => {
    const signature = signMockPayload(SECRET, NOW, BODY);
    expect(verifyMockSignature("x".repeat(40), { signature, timestamp: String(NOW) }, BODY, NOW)).toEqual({ ok: false, reason: "invalid" });
    const tampered = BODY.replace("succeeded", "failed");
    expect(verifyMockSignature(SECRET, { signature, timestamp: String(NOW) }, tampered, NOW)).toEqual({ ok: false, reason: "invalid" });
    expect(verifyMockSignature(SECRET, { signature, timestamp: String(NOW + 1) }, BODY, NOW)).toEqual({ ok: false, reason: "invalid" });
  });

  it("mal formée ou expirée", () => {
    expect(verifyMockSignature(SECRET, { signature: "abc", timestamp: String(NOW) }, BODY, NOW)).toEqual({ ok: false, reason: "malformed" });
    const old = NOW - 3600;
    expect(verifyMockSignature(SECRET, { signature: signMockPayload(SECRET, old, BODY), timestamp: String(old) }, BODY, NOW)).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("secret : PAYMENT_MOCK_SECRET, sinon dérivé de CRON_SECRET (différent de lui), sinon erreur", () => {
    expect(deriveMockSecret({ paymentMockSecret: SECRET, cronSecret: "c".repeat(40) })).toBe(SECRET);
    const derived = deriveMockSecret({ cronSecret: "c".repeat(40) });
    expect(derived).toMatch(/^[0-9a-f]{64}$/);
    expect(derived).not.toBe("c".repeat(40));
    expect(() => deriveMockSecret({})).toThrow(/PAYMENT_MOCK_SECRET/);
  });
});

describe("choix du fournisseur (RG-F6-3)", () => {
  it("mock configuré : autorisé partout", () => {
    expect(isProviderAllowed("mock", { configured: "mock", production: true })).toBe(true);
  });

  it("vrai fournisseur configuré : mock refusé en production, autorisé ailleurs", () => {
    expect(isProviderAllowed("mock", { configured: "fedapay", production: true })).toBe(false);
    expect(isProviderAllowed("mock", { configured: "fedapay", production: false })).toBe(true);
    expect(isProviderAllowed("kkiapay", { configured: "fedapay", production: false })).toBe(false);
  });

  it("production = VERCEL_ENV production uniquement", () => {
    expect(isProductionDeployment({ VERCEL_ENV: "production" })).toBe(true);
    expect(isProductionDeployment({ VERCEL_ENV: "preview" })).toBe(false);
    expect(isProductionDeployment({})).toBe(false);
  });
});

describe("entrée de la recharge", () => {
  it("ne garde que le pack : montant, crédits, bonus et code promo envoyés par le navigateur ignorés", () => {
    expect(startTopupSchema.parse({ packId: "2", amountXof: 1, credits: 9999, bonus_credits: 50, promoCode: "BIENVENUE" })).toEqual({ packId: 2 });
    expect(startTopupSchema.safeParse({ packId: "-1" }).success).toBe(false);
    expect(startTopupSchema.safeParse({ packId: "abc" }).success).toBe(false);
  });

  it("messages", () => {
    expect(topupErrorMessage("MAINTENANCE")).toMatch(/maintenance/);
    expect(topupErrorMessage("PROMO_DISABLED")).toMatch(/plus proposés/);
    expect(topupErrorMessage("XYZ")).toMatch(/Aucun montant/);
  });
});
