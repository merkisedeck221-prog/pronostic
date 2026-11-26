import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PerformanceStats } from "@/lib/settle/schemas";
import { LandingPerformance } from "./performance";

vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const base: PerformanceStats = {
  reveal_after_match: true,
  global: { won: 0, lost: 0, void: 0 },
  last_30_days: { won: 0, lost: 0, void: 0 },
  by_market: [],
  by_competition: [],
  by_week: [],
  recent: [],
};

describe("landing : performances de PRONEX AI", () => {
  it("sans pronostic résolu : état explicatif, aucun taux affiché", () => {
    const html = renderToStaticMarkup(<LandingPerformance stats={base} />);
    expect(html).toContain("Les premiers résultats arrivent bientôt");
    expect(html).not.toContain("%");
    expect(html).toContain('href="/performances"');
  });

  it("affiche le même taux que la page publique, perdus et annulés compris", () => {
    const stats: PerformanceStats = {
      ...base,
      global: { won: 30, lost: 10, void: 2 },
      last_30_days: { won: 6, lost: 4, void: 1 },
      by_market: [{ code: "BTTS", label: "Les deux équipes marquent", won: 5, lost: 5, void: 0 }],
    };
    const html = renderToStaticMarkup(<LandingPerformance stats={stats} />);
    expect(html).toContain("75 %"); // 30 ÷ (30 + 10), annulés exclus
    expect(html).toContain(">10<"); // perdus affichés
    expect(html).toContain(">2<"); // annulés affichés
    expect(html).toContain("Échantillon encore réduit");
  });

  it("données indisponibles : message, pas de chiffre", () => {
    const html = renderToStaticMarkup(<LandingPerformance stats={null} />);
    expect(html).toContain("momentanément indisponibles");
  });
});
