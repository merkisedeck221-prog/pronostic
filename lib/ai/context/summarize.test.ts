import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { injuryItemSchema, predictionsItemSchema } from "./schemas";
import { isThinHistory, lastFive, summarizeMatchContext, type SummaryInput } from "./summarize";

const recorded = <S extends z.ZodType>(file: string, schema: S): z.infer<S> =>
  schema.parse(JSON.parse(readFileSync(`tests/fixtures/api-football/${file}`, "utf8")).response);

const leaguePredictions = recorded("predictions-league.json", z.array(predictionsItemSchema))[0];
const leagueInjuries = recorded("injuries-league.json", z.array(injuryItemSchema));
const friendlyPredictions = recorded("predictions-friendly.json", z.array(predictionsItemSchema))[0];
const noInjuries = recorded("injuries-empty.json", z.array(injuryItemSchema));

const leagueInput: SummaryInput = {
  fixture: {
    kickoff_at: "2026-11-22T17:30:00+00:00",
    round: "Regular Season - 13",
    venue: "Old Trafford",
    home: { id: 1, api_team_id: 33, name: "Manchester United" },
    away: { id: 2, api_team_id: 40, name: "Liverpool" },
  },
  competition: { name: "Premier League", api_league_id: 39, category: "club_league", type: "league" },
  standings: {
    home: { rank: 5, points: 21, played: 12, goals_for: 20, goals_against: 14, form: "WDLWW" },
    away: { rank: 1, points: 27, played: 12, goals_for: 26, goals_against: 10, form: "WWLWD" },
  },
  recent: {
    home: [
      { date: "2026-11-15T15:00:00Z", result: "W" },
      { date: "2026-11-08T15:00:00Z", result: "L" },
      { date: "2026-11-01T15:00:00Z", result: "D" },
    ],
    away: [],
  },
  h2hFromDb: [{ date: "2026-04-12T15:30:00Z", home: "Liverpool", away: "Manchester United", goals_home: 1, goals_away: 1 }],
  predictions: leaguePredictions,
  injuries: leagueInjuries,
};

describe("summarizeMatchContext — championnat", () => {
  const summary = summarizeMatchContext(leagueInput);

  it("produit le format exact de la section 8", () => {
    expect(Object.keys(summary).sort()).toEqual(["away", "data_quality", "head_to_head", "home", "match", "provider_prediction"]);
    expect(summary.match).toEqual({
      competition: "Premier League",
      round: "Regular Season - 13",
      kickoff_utc: "2026-11-22T17:30:00Z",
      venue: "Old Trafford",
      is_neutral_venue: false,
      competition_type: "league",
    });
  });

  it("équipe à domicile : classement, forme en base (ancien → récent), bilan à domicile, moyennes, absences", () => {
    expect(summary.home).toEqual({
      name: "Manchester United",
      rank: 5,
      points: 21,
      played: 12,
      goals_for: 20,
      goals_against: 14,
      last5: "DLW",
      home_record: { w: 4, d: 1, l: 1 },
      avg_goals_for: 1.7,
      avg_goals_against: 1.2,
      absences: ["L. Shaw (absent : Muscle Injury)", "M. Mount (incertain : Knock)"],
    });
  });

  it("équipe à l'extérieur : forme du classement à défaut de matchs en base, bilan à l'extérieur", () => {
    expect(summary.away).toMatchObject({
      name: "Liverpool",
      last5: "WWLWD",
      away_record: { w: 3, d: 2, l: 1 },
      absences: ["A. Becker (absent : Suspended)"],
    });
    expect(summary.away).not.toHaveProperty("home_record");
  });

  it("confrontations : base + /predictions, sans doublon, du plus récent au plus ancien", () => {
    expect(summary.head_to_head).toEqual([
      { date: "2026-04-12", home: "Liverpool", away: "Manchester United", score: "1-1" },
      { date: "2025-12-14", home: "Manchester United", away: "Liverpool", score: "0-2" },
      { date: "2025-03-30", home: "Liverpool", away: "Manchester United", score: "3-2" },
    ]);
  });

  it("prédiction du fournisseur et qualité des données", () => {
    expect(summary.provider_prediction).toEqual({
      advice: "Double chance : Manchester United or draw",
      percent: { home: "45%", draw: "30%", away: "25%" },
      under_over: "-3.5",
    });
    expect(summary.data_quality).toEqual({ has_standings: true, h2h_count: 3, is_friendly: false });
    expect(isThinHistory(summary)).toBe(false);
  });
});

describe("summarizeMatchContext — match amical international", () => {
  const summary = summarizeMatchContext({
    fixture: {
      kickoff_at: "2026-11-18T19:00:00Z",
      round: "Friendlies 4",
      venue: null,
      home: { id: 10, api_team_id: 1504, name: "Senegal" },
      away: { id: 11, api_team_id: 1516, name: "Benin" },
    },
    competition: { name: "Matchs amicaux internationaux", api_league_id: 10, category: "international", type: "cup" },
    standings: { home: null, away: null },
    recent: { home: [], away: [] },
    h2hFromDb: [],
    predictions: friendlyPredictions,
    injuries: noInjuries,
  });

  it("marque le match comme amical, sans classement ni terrain neutre supposé", () => {
    expect(summary.match.competition_type).toBe("friendly");
    expect(summary.match.is_neutral_venue).toBe(false);
    expect(summary.data_quality).toEqual({ has_standings: false, h2h_count: 0, is_friendly: true });
  });

  it("utilise la forme et les moyennes de /predictions, sans inventer de classement", () => {
    expect(summary.home).toMatchObject({ rank: null, points: null, last5: "WD", avg_goals_for: 1.5, absences: [] });
    expect(summary.away).toMatchObject({ last5: "L", away_record: { w: 0, d: 0, l: 1 } });
  });

  it("historique mince : confiance « high » interdite", () => {
    expect(isThinHistory(summary)).toBe(true);
  });
});

describe("autres cas", () => {
  it("terrain neutre en phase finale d'un tournoi de sélections", () => {
    const summary = summarizeMatchContext({
      ...leagueInput,
      competition: { name: "Coupe d'Afrique des nations", api_league_id: 6, category: "international", type: "cup" },
    });
    expect(summary.match).toMatchObject({ is_neutral_venue: true, competition_type: "cup" });
  });

  it("sans /predictions : moyennes depuis le classement, provider_prediction null", () => {
    const summary = summarizeMatchContext({ ...leagueInput, predictions: null, injuries: [] });
    expect(summary.provider_prediction).toBeNull();
    expect(summary.home.avg_goals_for).toBe(1.67);
    expect(summary.home.home_record).toBeNull();
  });

  it("lastFive garde les 5 derniers résultats", () => {
    expect(lastFive("WDLWWDWLWW")).toBe("DWLWW");
    expect(lastFive(null)).toBeNull();
  });
});
