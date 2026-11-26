import { describe, expect, it } from "vitest";
import { fixtureContextSchema, formAverages } from "./context";

const side = (extra: object = {}) => ({ team_id: 1, form: [], ...extra });

describe("partie gratuite de la fiche match", () => {
  it("accepte les statistiques et absences, et les laisse facultatives", () => {
    const parsed = fixtureContextSchema.parse({
      fixture_id: 7,
      home: side({ stats: { matches: 3, corners_for: 5.3, corners_against: 4, cards: 2.1 }, absences: ["Joueur A (absent : Blessure)"] }),
      away: side(),
      head_to_head: [],
    });
    expect(parsed.home.stats?.corners_for).toBe(5.3);
    expect(parsed.home.absences).toEqual(["Joueur A (absent : Blessure)"]);
    expect(parsed.away.stats).toBeUndefined();
    expect(parsed.away.absences).toBeUndefined();
  });

  it("ignore toute clé inattendue (aucun champ du dossier ne fuit)", () => {
    const parsed = fixtureContextSchema.parse({ fixture_id: 7, home: side({ secret: "x" }), away: side(), prediction: "1" });
    expect(parsed).not.toHaveProperty("prediction");
    expect(parsed.home).not.toHaveProperty("secret");
  });

  it("calcule les moyennes de buts sur la forme récente", () => {
    const entry = (gf: number, ga: number) => ({ date: "2026-11-01", venue: "home" as const, opponent: "X", goals_for: gf, goals_against: ga, result: "W" as const });
    expect(formAverages({ form: [entry(2, 1), entry(1, 1), entry(0, 2)] })).toEqual({ scored: 1, conceded: 1.3, matches: 3 });
    expect(formAverages({ form: [] })).toBeNull();
  });
});
