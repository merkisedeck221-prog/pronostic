/**
 * Grille officielle PRONEX (décision du porteur, 25/11/2026) : packs fixes,
 * aucun bonus. Sert uniquement à CONTRÔLER les packs en base (page admin) ;
 * les prix réels restent ceux de la table credit_packs.
 */
export const OFFICIAL_PACK_GRID = [
  { name: "Starter", price_xof: 1000, credits: 10 },
  { name: "Basic", price_xof: 2500, credits: 25 },
  { name: "Premium", price_xof: 5000, credits: 50 },
  { name: "Pro", price_xof: 10000, credits: 110 },
  { name: "VIP", price_xof: 20000, credits: 250 },
] as const;

export type PackGridCheck = {
  name: string;
  expected: { price_xof: number; credits: number };
  actual: { price_xof: number; credits: number; bonus_credits: number; is_active: boolean } | null;
  conform: boolean;
};

/** Compare les packs en base à la grille officielle (nom sans tenir compte de la casse). */
export function checkPackGrid(
  packs: { name: string; price_xof: number; credits: number; bonus_credits: number; is_active: boolean }[],
): PackGridCheck[] {
  return OFFICIAL_PACK_GRID.map((official) => {
    const actual = packs.find((p) => p.name.trim().toLowerCase() === official.name.toLowerCase()) ?? null;
    const conform =
      actual !== null &&
      actual.price_xof === official.price_xof &&
      actual.credits === official.credits &&
      actual.bonus_credits === 0 &&
      actual.is_active;
    return { name: official.name, expected: { price_xof: official.price_xof, credits: official.credits }, actual, conform };
  });
}
