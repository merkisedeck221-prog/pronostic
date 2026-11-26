import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RateBars, WeeklyChart } from "./charts";

describe("graphiques de performances", () => {
  it("affiche les semaines avec un équivalent textuel accessible", () => {
    const html = renderToStaticMarkup(
      <WeeklyChart
        weeks={[
          { week_start: "2026-11-16", won: 3, lost: 1, void: 0 },
          { week_start: "2026-11-23", won: 0, lost: 0, void: 0 },
        ]}
      />,
    );
    expect(html).toContain("Pronostics résolus par semaine");
    expect(html).toContain("<td>3</td>");
    expect(html).toContain("Gagnés");
  });

  it("trie par volume et calcule le taux réel", () => {
    const html = renderToStaticMarkup(
      <RateBars
        emptyLabel="vide"
        rows={[
          { key: "a", name: "Petit", won: 1, lost: 0, void: 0 },
          { key: "b", name: "Grand", won: 3, lost: 1, void: 2 },
        ]}
      />,
    );
    expect(html.indexOf("Grand")).toBeLessThan(html.indexOf("Petit"));
    expect(html).toContain("75 %");
    expect(html).toContain("2 annulés");
  });

  it("affiche un état vide sans chiffre inventé", () => {
    expect(renderToStaticMarkup(<RateBars emptyLabel="Aucune donnée" rows={[]} />)).toContain("Aucune donnée");
  });
});
