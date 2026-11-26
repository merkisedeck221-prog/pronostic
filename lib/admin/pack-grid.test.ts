import { describe, expect, it } from "vitest";
import { checkPackGrid, OFFICIAL_PACK_GRID } from "./pack-grid";

const official = OFFICIAL_PACK_GRID.map((p) => ({ ...p, bonus_credits: 0, is_active: true }));

describe("contrôle de la grille officielle des packs", () => {
  it("valide la grille officielle", () => {
    expect(checkPackGrid(official).every((c) => c.conform)).toBe(true);
  });
  it("signale un prix, des crédits, un bonus ou une désactivation", () => {
    const changed = official.map((p) =>
      p.name === "Basic" ? { ...p, price_xof: 2000 } : p.name === "Pro" ? { ...p, bonus_credits: 5 } : p.name === "VIP" ? { ...p, is_active: false } : p,
    );
    const result = Object.fromEntries(checkPackGrid(changed).map((c) => [c.name, c.conform]));
    expect(result).toEqual({ Starter: true, Basic: false, Premium: true, Pro: false, VIP: false });
  });
  it("signale un pack manquant et ignore la casse du nom", () => {
    const checks = checkPackGrid(official.filter((p) => p.name !== "Starter").map((p) => ({ ...p, name: p.name.toUpperCase() })));
    expect(checks.find((c) => c.name === "Starter")?.actual).toBeNull();
    expect(checks.filter((c) => c.conform)).toHaveLength(4);
  });
});
