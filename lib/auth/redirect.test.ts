import { describe, expect, it } from "vitest";
import { loginUrl, safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it("accepte un chemin interne", () => {
    expect(safeNextPath("/matchs/42?onglet=pronostics")).toBe("/matchs/42?onglet=pronostics");
  });

  it.each([
    undefined,
    "",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "/connexion",
    "/auth/callback",
  ])("refuse %s et renvoie vers le tableau de bord", (value) => {
    expect(safeNextPath(value)).toBe("/tableau-de-bord");
  });
});

describe("loginUrl", () => {
  it("encode la page demandée", () => {
    expect(loginUrl("/profil")).toBe("/connexion?next=%2Fprofil");
    expect(loginUrl("https://evil.example")).toBe("/connexion");
    expect(loginUrl("/portefeuille", { expired: true })).toBe("/connexion?next=%2Fportefeuille&info=session-expiree");
    expect(loginUrl(null, { expired: true })).toBe("/connexion?info=session-expiree");
  });
});
