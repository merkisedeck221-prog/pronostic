import type { TablesInsert } from "@/types/database";
import type { Coverage, FixtureItem, LeagueItem, StandingRow, TeamItem } from "./schemas";

/**
 * Conversion des réponses API-Football vers nos tables (fonctions pures,
 * testées sur des réponses enregistrées).
 */

/** Statuts API-Football d'un match terminé (résolution possible, RG-F7-1). */
export const FINISHED_STATUSES = ["FT", "AET", "PEN"] as const;
/** Statuts où le match ne se jouera pas / plus à la date prévue. */
export const NOT_PLAYED_STATUSES = ["PST", "CANC", "ABD", "AWD", "WO"] as const;
/** Statuts « en cours ». */
export const LIVE_STATUSES = ["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"] as const;

export function isFinalStatus(status: string): boolean {
  return (FINISHED_STATUSES as readonly string[]).includes(status) || (NOT_PLAYED_STATUSES as readonly string[]).includes(status);
}

/** « Premier League » → « premier-league » (sans accents). */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function currentSeason(item: LeagueItem): { year: number; coverage: Coverage } | null {
  const season = item.seasons.find((s) => s.current) ?? null;
  return season ? { year: season.year, coverage: season.coverage ?? {} } : null;
}

/** Données d'une compétition issues de /leagues (sans is_active ni sort_order, réglés par l'admin). */
export function leagueToCompetitionUpdate(item: LeagueItem) {
  const season = currentSeason(item);
  return {
    name: item.league.name,
    type: item.league.type.toLowerCase() === "cup" ? ("cup" as const) : ("league" as const),
    country: item.country?.name ?? null,
    logo_url: item.league.logo ?? null,
    current_season: season?.year ?? null,
    coverage: (season?.coverage ?? {}) as TablesInsert<"competitions">["coverage"],
  };
}

export function teamToRow(item: TeamItem, isNational: boolean): TablesInsert<"teams"> {
  return {
    api_team_id: item.team.id,
    name: item.team.name,
    short_name: item.team.code ?? null,
    country: item.team.country ?? null,
    logo_url: item.team.logo ?? null,
    is_national: item.team.national ?? isNational,
  };
}

/** Équipe minimale issue d'un match ou d'un classement (création à la volée). */
export function teamRefToRow(team: { id: number; name: string; logo?: string | null }, isNational: boolean): TablesInsert<"teams"> {
  return { api_team_id: team.id, name: team.name, logo_url: team.logo ?? null, is_national: isNational };
}

/**
 * Ligne `fixtures` (sans is_published : la valeur par défaut s'applique à la
 * création et le choix de l'admin n'est jamais écrasé).
 * `original_kickoff_at` : premier coup d'envoi connu (pour détecter un report > 48 h).
 */
export function fixtureToRow(
  item: FixtureItem,
  ids: { competitionId: number; homeTeamId: number; awayTeamId: number },
  existingOriginalKickoff: string | null | undefined,
  now: Date,
): Omit<TablesInsert<"fixtures">, "is_published"> {
  const kickoff = new Date(item.fixture.date).toISOString();
  return {
    api_fixture_id: item.fixture.id,
    competition_id: ids.competitionId,
    season: item.league.season,
    round: item.league.round ?? null,
    kickoff_at: kickoff,
    status_short: item.fixture.status.short,
    status_long: item.fixture.status.long ?? null,
    home_team_id: ids.homeTeamId,
    away_team_id: ids.awayTeamId,
    goals_home: item.goals.home ?? null,
    goals_away: item.goals.away ?? null,
    ht_home: item.score.halftime?.home ?? null,
    ht_away: item.score.halftime?.away ?? null,
    // score.fulltime = score à la fin du temps réglementaire (hors prolongations et tirs au but, RG-F4-1).
    ft_home: item.score.fulltime?.home ?? null,
    ft_away: item.score.fulltime?.away ?? null,
    venue: item.fixture.venue?.name ?? null,
    original_kickoff_at: existingOriginalKickoff ?? kickoff,
    last_synced_at: now.toISOString(),
  };
}

/** Champs mis à jour par sync-results (score et statut uniquement). */
export function fixtureResultUpdate(item: FixtureItem, now: Date) {
  return {
    status_short: item.fixture.status.short,
    status_long: item.fixture.status.long ?? null,
    kickoff_at: new Date(item.fixture.date).toISOString(),
    goals_home: item.goals.home ?? null,
    goals_away: item.goals.away ?? null,
    ht_home: item.score.halftime?.home ?? null,
    ht_away: item.score.halftime?.away ?? null,
    ft_home: item.score.fulltime?.home ?? null,
    ft_away: item.score.fulltime?.away ?? null,
    last_synced_at: now.toISOString(),
  };
}

/** Forme « WDLWW » : seuls W, D, L sont conservés (contrainte de la table). */
export function normalizeForm(form: string | null | undefined): string | null {
  if (!form) return null;
  const cleaned = form.toUpperCase().replace(/[^WDL]/g, "").slice(-10);
  return cleaned || null;
}

export function standingToRow(
  row: StandingRow,
  ids: { competitionId: number; teamId: number; season: number; groupName: string },
): TablesInsert<"standings"> {
  return {
    competition_id: ids.competitionId,
    season: ids.season,
    group_name: ids.groupName,
    team_id: ids.teamId,
    rank: row.rank,
    points: row.points ?? 0,
    played: row.all.played ?? 0,
    won: row.all.win ?? 0,
    drawn: row.all.draw ?? 0,
    lost: row.all.lose ?? 0,
    goals_for: row.all.goals?.for ?? 0,
    goals_against: row.all.goals?.against ?? 0,
    form: normalizeForm(row.form),
  };
}

/** Découpe une liste en lots (ex. 20 identifiants par appel /fixtures?ids=). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Dates YYYY-MM-DD (UTC) de la fenêtre [aujourd'hui - daysBefore ; aujourd'hui + daysAfter]. */
export function dateWindow(now: Date, daysBefore: number, daysAfter: number): { from: string; to: string } {
  const day = 24 * 3600 * 1000;
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(new Date(now.getTime() - daysBefore * day)), to: iso(new Date(now.getTime() + daysAfter * day)) };
}
