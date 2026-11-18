import { describe, expect, it } from "vitest";
import { creditErrorMessage, toCreditErrorCode } from "./errors";
import { confidenceLabel, formatSignedAmount, transactionTypeLabel } from "./labels";
import { parsePage } from "./pagination";
import { parseAdjustResult, parseFixturePredictions, parsePriceResult, parseUnlockResult } from "./parse";
import { unlockInputSchema } from "./schemas";

describe("codes d'erreur", () => {
  it("traduit chaque code en français", () => {
    expect(creditErrorMessage("INSUFFICIENT_BALANCE")).toMatch(/Solde insuffisant/);
    expect(creditErrorMessage("ALREADY_UNLOCKED")).toMatch(/déjà débloqué/);
    expect(creditErrorMessage("MATCH_STARTED")).toMatch(/déblocages sont fermés/);
    expect(creditErrorMessage("MAINTENANCE")).toMatch(/maintenance/);
    expect(creditErrorMessage("BANNED")).toMatch(/suspendu/);
    expect(creditErrorMessage("NOT_AVAILABLE")).toMatch(/pas disponible/);
  });

  it("conserve le message SQL précis pour NOT_AVAILABLE", () => {
    expect(creditErrorMessage("NOT_AVAILABLE", "Le déblocage du match complet n'est pas proposé.")).toBe(
      "Le déblocage du match complet n'est pas proposé.",
    );
  });

  it("code inconnu → UNKNOWN, sans débit annoncé", () => {
    expect(toCreditErrorCode("DROP TABLE")).toBe("UNKNOWN");
    expect(creditErrorMessage(undefined)).toMatch(/Aucun crédit n'a été débité/);
  });
});

describe("parseUnlockResult", () => {
  it("succès", () => {
    expect(parseUnlockResult({ ok: true, new_balance: 8, credits_spent: 2, market_code: "BTTS" })).toEqual({
      ok: true,
      newBalance: 8,
      creditsSpent: 2,
    });
  });

  it("solde insuffisant : code, message, prix et solde", () => {
    expect(parseUnlockResult({ ok: false, code: "INSUFFICIENT_BALANCE", message: "x", price: 3, balance: 1 })).toMatchObject({
      ok: false,
      code: "INSUFFICIENT_BALANCE",
      price: 3,
      balance: 1,
    });
  });

  it("réponse inattendue → UNKNOWN", () => {
    expect(parseUnlockResult(null)).toMatchObject({ ok: false, code: "UNKNOWN" });
    expect(parseUnlockResult({ ok: true, new_balance: -1, credits_spent: 2 })).toMatchObject({ ok: false, code: "UNKNOWN" });
  });
});

describe("parsePriceResult / parseAdjustResult", () => {
  it("prix", () => {
    expect(parsePriceResult({ ok: true, price: 5, base_price: 7, deduction: 2 })).toEqual({
      ok: true,
      price: 5,
      basePrice: 7,
      deduction: 2,
    });
    expect(parsePriceResult({ ok: false, code: "NOT_AVAILABLE", message: "Non proposé." })).toMatchObject({
      ok: false,
      message: "Non proposé.",
    });
  });

  it("ajustement", () => {
    expect(parseAdjustResult({ ok: true, new_balance: 10, transaction_id: 4 })).toEqual({ ok: true, newBalance: 10, transactionId: 4 });
    expect(parseAdjustResult({ ok: false, code: "FORBIDDEN" })).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });
});

describe("parseFixturePredictions", () => {
  const base = {
    fixture_id: 1,
    is_finished: false,
    unlocks_open: true,
    pricing_mode: "both",
    match_bundle: { unlocked: false, offered: true, price: 7, base_price: 7, purchasable: true },
    analysis: null,
  };

  it("marché verrouillé : aucun contenu", () => {
    const parsed = parseFixturePredictions({
      ...base,
      markets: [{ code: "BTTS", label: "Les deux équipes marquent", unlocked: false, price: 2, purchasable: true, revealed: false }],
    });
    expect(parsed?.markets[0].selection_label).toBeUndefined();
  });

  it("marché débloqué : contenu", () => {
    const parsed = parseFixturePredictions({
      ...base,
      markets: [
        {
          code: "MATCH_RESULT",
          label: "1N2",
          unlocked: true,
          price: 2,
          purchasable: false,
          revealed: true,
          selection: "1",
          selection_label: "Victoire d'Arsenal",
          probability: 55,
          probabilities: { home: 55, draw: 25, away: 20 },
          confidence: "medium",
          reasoning: "…",
          result: "pending",
        },
      ],
      analysis: { summary: "Résumé", key_factors: ["a", "b", "c"] },
    });
    expect(parsed?.markets[0].probabilities).toEqual({ home: 55, draw: 25, away: 20 });
    expect(parsed?.analysis?.key_factors).toHaveLength(3);
  });

  it("null (match invisible) ou format invalide → null", () => {
    expect(parseFixturePredictions(null)).toBeNull();
    expect(parseFixturePredictions({ foo: 1 })).toBeNull();
  });
});

describe("entrée du déblocage", () => {
  it("n'accepte ni prix ni identifiant d'utilisateur, et un code de marché strict", () => {
    expect(unlockInputSchema.parse({ fixtureId: 3, marketCode: null, price: 0, userId: "x" })).toEqual({ fixtureId: 3, marketCode: null });
    expect(unlockInputSchema.safeParse({ fixtureId: 3, marketCode: "btts'; --" }).success).toBe(false);
    expect(unlockInputSchema.safeParse({ fixtureId: -1, marketCode: "BTTS" }).success).toBe(false);
  });
});

describe("libellés", () => {
  it("types de transaction, confiance, montants signés", () => {
    expect(transactionTypeLabel("unlock")).toBe("Déblocage");
    expect(transactionTypeLabel("admin_adjustment")).toBe("Ajustement");
    expect(confidenceLabel("high")).toBe("Élevé");
    expect(formatSignedAmount(10)).toBe("+10");
    expect(formatSignedAmount(-3)).toBe("−3");
    expect(formatSignedAmount(1500)).toMatch(/^\+1\s500$/);
  });

  it("page", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-2")).toBe(1);
    expect(parsePage(["2", "5"])).toBe(2);
    expect(parsePage("abc")).toBe(1);
  });
});
