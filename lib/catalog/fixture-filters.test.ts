import { describe, expect, it } from "vitest";
import { matchesSearch, matchesStatusFilter, normalizeSearch, parseDay, parseSearch, parseStatusFilter } from "./fixture-filters";

describe("filtres de la liste des matchs", () => {
  it("lit le statut demandé, sinon « tous »", () => {
    expect(parseStatusFilter("termines")).toBe("termines");
    expect(parseStatusFilter(["en-cours"])).toBe("en-cours");
    expect(parseStatusFilter("autre")).toBe("tous");
    expect(parseStatusFilter(undefined)).toBe("tous");
  });

  it("classe les statuts API-Football par phase", () => {
    expect(matchesStatusFilter("a-venir", "NS")).toBe(true);
    expect(matchesStatusFilter("a-venir", "TBD")).toBe(true);
    expect(matchesStatusFilter("en-cours", "2H")).toBe(true);
    expect(matchesStatusFilter("termines", "AET")).toBe(true);
    expect(matchesStatusFilter("reportes", "PST")).toBe(true);
    expect(matchesStatusFilter("reportes", "FT")).toBe(false);
    expect(matchesStatusFilter("tous", "CANC")).toBe(true);
  });

  it("recherche sans tenir compte des accents ni de la casse", () => {
    expect(normalizeSearch("  Étoile   du SAHEL ")).toBe("etoile du sahel");
    expect(matchesSearch("etoile", ["Étoile du Sahel", "Espérance"])).toBe(true);
    expect(matchesSearch("real madrid", ["Real Madrid", "Barcelona", "LaLiga"])).toBe(true);
    expect(matchesSearch("madrid barc", ["Real Madrid", "Barcelona"])).toBe(true);
    expect(matchesSearch("psg", ["Real Madrid", "Barcelona"])).toBe(false);
    expect(matchesSearch("", ["x"])).toBe(true);
    expect(matchesSearch("liga", ["Real Madrid", "Barcelona", "LaLiga"])).toBe(true);
  });

  it("nettoie et limite le texte recherché", () => {
    expect(parseSearch("  real   madrid ")).toBe("real madrid");
    expect(parseSearch("x".repeat(100))).toHaveLength(60);
    expect(parseSearch(42)).toBe("");
  });

  it("n'accepte qu'un jour calendaire valide", () => {
    expect(parseDay("2026-11-27")).toBe("2026-11-27");
    expect(parseDay("2026-02-30")).toBeNull();
    expect(parseDay("27/11/2026")).toBeNull();
    expect(parseDay("1999-01-01")).toBeNull();
    expect(parseDay(undefined)).toBeNull();
  });
});
