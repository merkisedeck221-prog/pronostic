import { describe, expect, it } from "vitest";
import { parseRevenuePeriod } from "./revenue";

const NOW = new Date("2026-11-23T23:30:00Z"); // 24/11 à 00:30 à Porto-Novo

describe("parseRevenuePeriod", () => {
  it("par défaut : du 1er du mois à aujourd'hui (heure de Porto-Novo)", () => {
    expect(parseRevenuePeriod({}, NOW)).toEqual({ from: "2026-11-01", to: "2026-11-24" });
  });
  it("garde une période valide et remet une période inversée dans l'ordre", () => {
    expect(parseRevenuePeriod({ du: "2026-10-01", au: "2026-10-31" }, NOW)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(parseRevenuePeriod({ du: "2026-10-31", au: "2026-10-01" }, NOW)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });
  it("ignore les valeurs invalides", () => {
    expect(parseRevenuePeriod({ du: "2026-02-30", au: "n'importe quoi" }, NOW)).toEqual({ from: "2026-11-01", to: "2026-11-24" });
    expect(parseRevenuePeriod({ du: ["2026-10-05"], au: ["2026-10-06"] }, NOW)).toEqual({ from: "2026-10-05", to: "2026-10-06" });
  });
  it("limite la période à 2 ans", () => {
    const { from, to } = parseRevenuePeriod({ du: "2000-01-01", au: "2026-11-01" }, NOW);
    expect(to).toBe("2026-11-01");
    expect((Date.parse(to) - Date.parse(from)) / 86_400_000).toBe(731);
  });
});
