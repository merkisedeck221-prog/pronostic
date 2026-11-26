import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { faqItems, LandingFaq, type FaqContext } from "./faq";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

const context: FaqContext = {
  marketLabels: ["Résultat du match (1N2)", "Score exact", "Combiné IA"],
  pricing: { marketMin: 2, marketMax: 3, bundle: 7 },
  packs: [
    {
      id: 1,
      name: "Starter",
      credits: 10,
      price_xof: 1000,
      is_featured: false,
    },
  ],
  refundOnCancel: true,
  revealAfterMatch: true,
};

describe("landing : FAQ", () => {
  it("contient les 10 questions du brief, dans l'ordre", () => {
    expect(faqItems(context).map((i) => i.q)).toEqual([
      "Qu'est-ce que PRONEX ?",
      "Comment fonctionne PRONEX AI ?",
      "Quels types de pronostics sont disponibles ?",
      "Comment obtenir des crédits ?",
      "Comment débloquer un pronostic ?",
      "Puis-je consulter mes pronostics achetés ?",
      "Comment sont calculées les performances ?",
      "PRONEX garantit-il des gains ?",
      "Puis-je utiliser PRONEX sur mon smartphone ?",
      "Comment créer un compte ?",
    ]);
  });

  it("insiste : estimations, aucun gain garanti", () => {
    const gains = faqItems(context).find(
      (i) => i.q === "PRONEX garantit-il des gains ?",
    );
    expect(gains?.a).toMatch(/^Non\./);
    expect(gains?.a).toContain("ne garantit aucun gain");
    expect(renderToStaticMarkup(<LandingFaq {...context} />)).toContain(
      "estimations",
    );
  });

  it("reprend les vrais prix, packs et réglages", () => {
    const all = faqItems(context)
      .map((i) => i.a)
      .join(" ");
    expect(all).toContain("2 ou 3 crédits");
    expect(all).toContain("7 crédits pour le match complet");
    expect(all).toContain(
      "Starter : 1 000 FCFA pour 10 crédits"
        .replace(" ", " ")
        .replace("1 000", new Intl.NumberFormat("fr-FR").format(1000)),
    );
    expect(all).toContain("reporté de plus de 48 heures");
    expect(all).toContain("même match");
  });

  it("n'annonce pas de remboursement si le réglage est désactivé", () => {
    const all = faqItems({ ...context, refundOnCancel: false })
      .map((i) => i.a)
      .join(" ");
    expect(all).not.toContain("48 heures");
  });

  it("ajoute les données structurées FAQPage", () => {
    expect(renderToStaticMarkup(<LandingFaq {...context} />)).toContain(
      '"@type":"FAQPage"',
    );
  });
});
