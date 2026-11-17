import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  chunk,
  currentSeason,
  dateWindow,
  fixtureResultUpdate,
  fixtureToRow,
  isFinalStatus,
  leagueToCompetitionUpdate,
  normalizeForm,
  slugify,
  standingToRow,
  teamRefToRow,
} from "./convert";
import { fixtureItemSchema, leagueItemSchema, standingsItemSchema } from "./schemas";

function recorded<S extends z.ZodType>(file: string, schema: S): z.infer<S> {
  const body = JSON.parse(readFileSync(`tests/fixtures/api-football/${file}`, "utf8"));
  return schema.parse(body.response);
}

const leagues = recorded("leagues-premier-league.json", z.array(leagueItemSchema));
const friendlies = recorded("leagues-friendlies.json", z.array(leagueItemSchema));
const fixtures = recorded("fixtures-premier-league.json", z.array(fixtureItemSchema));
const standings = recorded("standings-premier-league.json", z.array(standingsItemSchema));
const now = new Date("2026-11-17T12:00:00Z");

describe("leagues → competitions", () => {
  it("lit la saison en cours et sa couverture", () => {
    expect(currentSeason(leagues[0])?.year).toBe(2026);
    expect(leagueToCompetitionUpdate(leagues[0])).toMatchObject({
      name: "Premier League",
      type: "league",
      country: "England",
      current_season: 2026,
      coverage: { standings: true, predictions: true, injuries: true },
    });
  });

  it("choisit la saison marquée current parmi plusieurs et reconnaît une coupe", () => {
    expect(leagueToCompetitionUpdate(friendlies[0])).toMatchObject({ type: "cup", current_season: 2026, coverage: { standings: false } });
  });
});

describe("fixtures → fixtures", () => {
  const ids = { competitionId: 7, homeTeamId: 100, awayTeamId: 200 };

  it("convertit un match terminé (heure UTC, scores, mi-temps, temps réglementaire)", () => {
    const row = fixtureToRow(fixtures[0], ids, undefined, now);
    expect(row).toMatchObject({
      api_fixture_id: 1300001,
      competition_id: 7,
      season: 2026,
      round: "Regular Season - 12",
      kickoff_at: "2026-11-15T15:00:00.000Z",
      status_short: "FT",
      status_long: "Match Finished",
      goals_home: 2,
      goals_away: 1,
      ht_home: 1,
      ht_away: 0,
      ft_home: 2,
      ft_away: 1,
      venue: "Emirates Stadium",
      original_kickoff_at: "2026-11-15T15:00:00.000Z",
    });
    expect(row).not.toHaveProperty("is_published"); // jamais écrasé par la synchronisation
  });

  it("garde le score du temps réglementaire, pas celui après prolongations (RG-F4-1)", () => {
    const row = fixtureToRow(fixtures[3], ids, undefined, now);
    expect(row).toMatchObject({ status_short: "PEN", goals_home: 2, goals_away: 2, ft_home: 1, ft_away: 1 });
  });

  it("conserve le coup d'envoi initial d'un match reporté (RG-F5-7)", () => {
    const row = fixtureToRow(fixtures[2], ids, "2026-11-20T14:00:00.000Z", now);
    expect(row.status_short).toBe("PST");
    expect(row.original_kickoff_at).toBe("2026-11-20T14:00:00.000Z");
    expect(row.kickoff_at).toBe("2026-11-23T14:00:00.000Z");
    expect(row.venue).toBeNull();
  });

  it("met à jour uniquement score et statut pour sync-results", () => {
    const update = fixtureResultUpdate(fixtures[0], now);
    expect(Object.keys(update).sort()).toEqual(
      ["ft_away", "ft_home", "goals_away", "goals_home", "ht_away", "ht_home", "kickoff_at", "last_synced_at", "status_long", "status_short"].sort(),
    );
  });

  it("crée une équipe minimale à la volée", () => {
    expect(teamRefToRow(fixtures[1].teams.home, false)).toEqual({
      api_team_id: 33,
      name: "Manchester United",
      logo_url: "https://media.api-sports.io/football/teams/33.png",
      is_national: false,
    });
  });
});

describe("standings → standings", () => {
  it("convertit une ligne de classement", () => {
    const row = standings[0].league.standings[0][0];
    expect(standingToRow(row, { competitionId: 7, teamId: 100, season: 2026, groupName: row.group ?? "" })).toEqual({
      competition_id: 7,
      season: 2026,
      group_name: "Premier League",
      team_id: 100,
      rank: 1,
      points: 30,
      played: 12,
      won: 9,
      drawn: 3,
      lost: 0,
      goals_for: 25,
      goals_against: 8,
      form: "WWDWW",
    });
  });

  it("nettoie la forme pour respecter la contrainte de la table", () => {
    expect(normalizeForm("w-d-l?WWWWWWWWW")).toBe("LWWWWWWWWW"); // 10 derniers résultats
    expect(normalizeForm(null)).toBeNull();
    expect(normalizeForm("???")).toBeNull();
  });
});

describe("utilitaires", () => {
  it("statuts finaux", () => {
    expect(["FT", "AET", "PEN", "PST", "CANC"].every(isFinalStatus)).toBe(true);
    expect(["NS", "1H", "HT", "2H", "ET"].some(isFinalStatus)).toBe(false);
  });

  it("slugify, chunk, dateWindow", () => {
    expect(slugify("Ligue des nations UEFA")).toBe("ligue-des-nations-uefa");
    expect(slugify("Coupe d'Afrique des nations")).toBe("coupe-d-afrique-des-nations");
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(dateWindow(now, 3, 14)).toEqual({ from: "2026-11-14", to: "2026-12-01" });
  });
});
