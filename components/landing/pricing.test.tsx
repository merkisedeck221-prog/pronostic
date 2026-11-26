import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LandingPricing } from "./pricing";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

/** Grille officielle PRONEX (CLAUDE.md, 25/11/2026) : aucun bonus. */
const PACKS = [
  { id: 1, name: "Starter", credits: 10, price_xof: 1000, is_featured: false },
  { id: 2, name: "Basic", credits: 25, price_xof: 2500, is_featured: false },
  { id: 3, name: "Premium", credits: 50, price_xof: 5000, is_featured: true },
  { id: 4, name: "Pro", credits: 110, price_xof: 10000, is_featured: false },
  { id: 5, name: "VIP", credits: 250, price_xof: 20000, is_featured: false },
];

describe("landing : tarifs et crédits", () => {
  const html = renderToStaticMarkup(
    <LandingPricing
      packs={PACKS}
      pricing={{ marketMin: 2, marketMax: 3, bundle: 7 }}
    />,
  );
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/ | /g, " ");

  it("affiche les prix et crédits exacts des 5 packs", () => {
    for (const [credits, price] of [
      ["10", "1 000"],
      ["25", "2 500"],
      ["50", "5 000"],
      ["110", "10 000"],
      ["250", "20 000"],
    ]) {
      expect(text).toContain(`${credits} crédits`);
      expect(text).toContain(`${price} FCFA`);
    }
  });

  it("met en avant un seul pack (PREMIUM), sans bonus ni promesse de gain", () => {
    expect(text.match(/Recommandé/g)).toHaveLength(1);
    expect(text).not.toMatch(
      /bonus|offert|gratuit|gagnez|gains? garantis?|résultats? garantis?/i,
    );
    expect(text).toContain("sans garantie de résultat");
  });

  it("affiche les prix réels des pronostics et mène vers l'inscription", () => {
    expect(text).toContain("2 ou 3 crédits");
    expect(text).toContain("7 crédits");
    expect(html).toContain('href="/inscription"');
  });
});
