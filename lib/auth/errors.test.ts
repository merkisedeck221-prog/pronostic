import { describe, expect, it } from "vitest";
import { GENERIC_ERROR, authErrorMessage } from "./errors";

describe("authErrorMessage", () => {
  it("traduit une adresse refusée par Supabase", () => {
    expect(authErrorMessage({ code: "email_address_invalid" })).toMatch(/adresse e-mail n'est pas acceptée/);
  });
  it("traduit la limite de requêtes (429)", () => {
    expect(authErrorMessage({ status: 429 })).toMatch(/Trop de tentatives/);
  });
  it("renvoie le message générique pour une erreur inconnue ou absente", () => {
    expect(authErrorMessage({ code: "inconnu" })).toBe(GENERIC_ERROR);
    expect(authErrorMessage(null)).toBe(GENERIC_ERROR);
  });
});
