import type { InjuryItem, PredictionsItem } from "./schemas";

/**
 * Résumé compact du dossier de match envoyé à l'IA — format exact de la
 * section 8 du cahier des charges (« Le dossier envoyé à l'IA »).
 * Fonction PURE : toutes les données sont fournies par l'appelant.
 */

export type TeamRecord = { w: number; d: number; l: number };

export type TeamSummary = {
  name: string;
  rank: number | null;
  points: number | null;
  played: number | null;
  goals_for: number | null;
  goals_against: number | null;
  /** 5 derniers résultats, du plus ancien au plus récent (ex. « WWDWL »). */
  last5: string | null;
  /** Bilan à domicile (équipe qui reçoit) ou à l'extérieur (équipe qui se déplace). */
  home_record?: TeamRecord | null;
  away_record?: TeamRecord | null;
  avg_goals_for: number | null;
  avg_goals_against: number | null;
  absences: string[];
  /**
   * Corners et cartons (lot B) : moyennes sur les derniers matchs terminés dont
   * les statistiques sont en base ; absent des dossiers construits avant le lot B.
   */
  match_stats?: TeamMatchStats;
};

export type TeamMatchStats = {
  /** Nombre de matchs utilisés (0 à 5). */
  matches: number;
  avg_corners_for: number | null;
  avg_corners_against: number | null;
  avg_cards: number | null;
};

/** Statistiques d'un match terminé, du point de vue d'une équipe. */
export type TeamStatsInput = { corners_for: number | null; corners_against: number | null; cards: number | null };

/** En dessous de ce nombre de matchs avec statistiques, la confiance des marchés corners / cartons est « low ». */
export const MIN_STATS_MATCHES = 3;

export type MatchSummary = {
  match: {
    competition: string;
    round: string | null;
    kickoff_utc: string;
    venue: string | null;
    is_neutral_venue: boolean;
    competition_type: "league" | "cup" | "friendly";
  };
  home: TeamSummary;
  away: TeamSummary;
  head_to_head: { date: string; home: string; away: string; score: string }[];
  provider_prediction: {
    advice: string | null;
    percent: { home: string | null; draw: string | null; away: string | null };
    under_over: string | null;
  } | null;
  data_quality: DataQuality;
};

/** Fiabilité d'une source du dossier : complète, partielle ou absente. */
export type Availability = "reliable" | "partial" | "unavailable";

export type DataAvailability = {
  form: Availability;
  standings: Availability;
  head_to_head: Availability;
  goal_averages: Availability;
  corners_cards: Availability;
  injuries: Availability;
  provider_prediction: Availability;
};

export type DataQuality = {
  has_standings: boolean;
  h2h_count: number;
  is_friendly: boolean;
  /** Fiabilité par source (dossiers construits depuis le prompt v4 ; absent avant). */
  availability?: DataAvailability;
  /** Données insuffisantes : ni forme, ni classement, ni confrontation exploitables. */
  insufficient_data?: boolean;
  /** Sources indisponibles ou partielles, en clair (pour l'IA et l'administration). */
  notes?: string[];
};

export type StandingInput = {
  rank: number;
  points: number;
  played: number;
  goals_for: number;
  goals_against: number;
  form: string | null;
};

/** Match terminé en base, du point de vue d'une équipe. */
export type RecentResult = { date: string; result: "W" | "D" | "L" };

export type H2HInput = { date: string; home: string; away: string; goals_home: number; goals_away: number };

export type SummaryInput = {
  fixture: {
    kickoff_at: string;
    round: string | null;
    venue: string | null;
    home: { id: number; api_team_id: number; name: string };
    away: { id: number; api_team_id: number; name: string };
  };
  competition: { name: string; api_league_id: number; category: "club_league" | "international"; type: string };
  standings: { home: StandingInput | null; away: StandingInput | null };
  recent: { home: RecentResult[]; away: RecentResult[] };
  /** Confrontations en base (complétées par /predictions.h2h). */
  h2hFromDb: H2HInput[];
  predictions: PredictionsItem | null;
  injuries: InjuryItem[];
  /** Statistiques des derniers matchs (récent → ancien), lot B. */
  matchStats?: { home: TeamStatsInput[]; away: TeamStatsInput[] };
  /**
   * Absences réellement interrogées (/injuries couvert et appel réussi) : une liste
   * vide signifie alors « aucune absence signalée », sinon « information indisponible ».
   */
  injuriesChecked?: boolean;
};

/** Identifiant API-Football des matchs amicaux internationaux. */
export const FRIENDLIES_LEAGUE_ID = 10;

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace("%", ""));
  return Number.isFinite(n) ? n : null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function isFriendly(competition: SummaryInput["competition"]): boolean {
  return competition.api_league_id === FRIENDLIES_LEAGUE_ID || /friendl|amica/i.test(competition.name);
}

export function competitionType(competition: SummaryInput["competition"]): MatchSummary["match"]["competition_type"] {
  if (isFriendly(competition)) return "friendly";
  return competition.type === "cup" ? "cup" : "league";
}

/**
 * Terrain neutre (heuristique) : phase finale d'un tournoi de sélections
 * (CAN, Coupe du monde, Euro, Copa América…). API-Football ne le précise pas.
 */
export function isNeutralVenue(competition: SummaryInput["competition"]): boolean {
  return (
    competition.category === "international" &&
    competition.type === "cup" &&
    !isFriendly(competition) &&
    !/qualif/i.test(competition.name)
  );
}

/** « WDLWW » limité aux 5 derniers résultats (ordre : ancien → récent). */
export function lastFive(form: string | null | undefined): string | null {
  const cleaned = (form ?? "").toUpperCase().replace(/[^WDL]/g, "");
  return cleaned ? cleaned.slice(-5) : null;
}

function absenceLabel(item: InjuryItem): string {
  const type = (item.player.type ?? "").toLowerCase();
  const status = type.includes("questionable") ? "incertain" : "absent";
  const reason = item.player.reason ? ` : ${item.player.reason}` : "";
  return `${item.player.name} (${status}${reason})`;
}

function record(
  stats: NonNullable<PredictionsItem["teams"]["home"]["league"]> | null | undefined,
  side: "home" | "away",
): TeamRecord | null {
  const w = toNumber(stats?.fixtures?.wins?.[side]);
  const d = toNumber(stats?.fixtures?.draws?.[side]);
  const l = toNumber(stats?.fixtures?.loses?.[side]);
  return w === null || d === null || l === null ? null : { w, d, l };
}

function teamSummary(
  side: "home" | "away",
  input: SummaryInput,
): TeamSummary {
  const team = input.fixture[side];
  const standing = input.standings[side];
  const stats = input.predictions?.teams[side]?.league ?? null;

  // Forme : matchs terminés en base (récent → ancien en entrée), sinon classement, sinon /predictions.
  const fromDb = input.recent[side].length > 0
    ? [...input.recent[side]].sort((a, b) => a.date.localeCompare(b.date)).map((r) => r.result).join("")
    : null;
  const last5 = lastFive(fromDb) ?? lastFive(standing?.form) ?? lastFive(stats?.form);

  const avgFor = toNumber(stats?.goals?.for?.average?.total) ?? (standing && standing.played > 0 ? round2(standing.goals_for / standing.played) : null);
  const avgAgainst =
    toNumber(stats?.goals?.against?.average?.total) ?? (standing && standing.played > 0 ? round2(standing.goals_against / standing.played) : null);

  const summary: TeamSummary = {
    name: team.name,
    rank: standing?.rank ?? null,
    points: standing?.points ?? null,
    played: standing?.played ?? null,
    goals_for: standing?.goals_for ?? null,
    goals_against: standing?.goals_against ?? null,
    last5,
    avg_goals_for: avgFor,
    avg_goals_against: avgAgainst,
    absences: input.injuries.filter((i) => i.team.id === team.api_team_id).map(absenceLabel),
  };
  if (side === "home") summary.home_record = record(stats, "home");
  else summary.away_record = record(stats, "away");
  if (input.matchStats) summary.match_stats = teamMatchStats(input.matchStats[side]);
  return summary;
}

function average(values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v !== null);
  return known.length ? round2(known.reduce((a, b) => a + b, 0) / known.length) : null;
}

/** Moyennes sur les 5 derniers matchs avec statistiques. */
export function teamMatchStats(rows: TeamStatsInput[]): TeamMatchStats {
  const last = rows.filter((r) => r.corners_for !== null || r.cards !== null).slice(0, 5);
  return {
    matches: last.length,
    avg_corners_for: average(last.map((r) => r.corners_for)),
    avg_corners_against: average(last.map((r) => r.corners_against)),
    avg_cards: average(last.map((r) => r.cards)),
  };
}

function headToHead(input: SummaryInput): MatchSummary["head_to_head"] {
  const rows = new Map<string, MatchSummary["head_to_head"][number]>();
  for (const m of input.h2hFromDb) {
    const date = m.date.slice(0, 10);
    rows.set(`${date}|${m.home}|${m.away}`, { date, home: m.home, away: m.away, score: `${m.goals_home}-${m.goals_away}` });
  }
  for (const m of input.predictions?.h2h ?? []) {
    if (m.goals.home === null || m.goals.home === undefined || m.goals.away === null || m.goals.away === undefined) continue;
    const status = m.fixture.status?.short;
    if (status && !["FT", "AET", "PEN"].includes(status)) continue;
    const date = m.fixture.date.slice(0, 10);
    const key = `${date}|${m.teams.home.name}|${m.teams.away.name}`;
    if (!rows.has(key)) rows.set(key, { date, home: m.teams.home.name, away: m.teams.away.name, score: `${m.goals.home}-${m.goals.away}` });
  }
  return [...rows.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
}

export function summarizeMatchContext(input: SummaryInput): MatchSummary {
  const friendly = isFriendly(input.competition);
  const h2h = headToHead(input);
  const prediction = input.predictions?.predictions;
  const home = teamSummary("home", input);
  const away = teamSummary("away", input);

  return {
    match: {
      competition: input.competition.name,
      round: input.fixture.round,
      kickoff_utc: new Date(input.fixture.kickoff_at).toISOString().replace(".000Z", "Z"),
      venue: input.fixture.venue,
      is_neutral_venue: isNeutralVenue(input.competition),
      competition_type: competitionType(input.competition),
    },
    home,
    away,
    head_to_head: h2h,
    provider_prediction: prediction
      ? {
          advice: prediction.advice ?? null,
          percent: {
            home: prediction.percent?.home ?? null,
            draw: prediction.percent?.draw ?? null,
            away: prediction.percent?.away ?? null,
          },
          under_over: prediction.under_over ?? null,
        }
      : null,
    data_quality: dataQuality(input, home, away, h2h.length, friendly, Boolean(prediction)),
  };
}

const NOTE_LABELS: Record<keyof DataAvailability, string> = {
  form: "forme récente",
  standings: "classement",
  head_to_head: "confrontations directes",
  goal_averages: "moyennes de buts",
  corners_cards: "statistiques de corners et cartons",
  injuries: "absences et blessures",
  provider_prediction: "prédiction du fournisseur de données",
};

/** Deux équipes → fiable, une seule → partielle, aucune → indisponible. */
function both(home: boolean, away: boolean): Availability {
  return home && away ? "reliable" : home || away ? "partial" : "unavailable";
}

/**
 * Qualité du dossier (fonction pure) : chaque source est classée fiable,
 * partielle ou indisponible, et le dossier est déclaré insuffisant quand
 * ni la forme, ni le classement, ni les confrontations ne sont exploitables.
 */
export function dataQuality(
  input: SummaryInput,
  home: TeamSummary,
  away: TeamSummary,
  h2hCount: number,
  friendly: boolean,
  hasProviderPrediction: boolean,
): DataQuality {
  const formLen = (t: TeamSummary) => t.last5?.length ?? 0;
  const statsOk = (t: TeamSummary) => (t.match_stats?.matches ?? 0) >= MIN_STATS_MATCHES;
  const statsAny = (t: TeamSummary) => (t.match_stats?.matches ?? 0) > 0;
  const availability: DataAvailability = {
    form:
      formLen(home) >= 5 && formLen(away) >= 5
        ? "reliable"
        : formLen(home) >= 3 || formLen(away) >= 3
          ? "partial"
          : "unavailable",
    standings: both(Boolean(input.standings.home), Boolean(input.standings.away)),
    head_to_head: h2hCount >= 3 ? "reliable" : h2hCount > 0 ? "partial" : "unavailable",
    goal_averages: both(home.avg_goals_for !== null && home.avg_goals_against !== null, away.avg_goals_for !== null && away.avg_goals_against !== null),
    corners_cards: statsOk(home) && statsOk(away) ? "reliable" : statsAny(home) || statsAny(away) ? "partial" : "unavailable",
    injuries: input.injuriesChecked || input.injuries.length > 0 ? "reliable" : "unavailable",
    provider_prediction: hasProviderPrediction ? "reliable" : "unavailable",
  };
  const notes = (Object.keys(availability) as (keyof DataAvailability)[])
    .filter((key) => availability[key] !== "reliable")
    .map((key) => `${NOTE_LABELS[key]} : ${availability[key] === "partial" ? "données incomplètes" : "indisponible"}`);
  return {
    has_standings: Boolean(input.standings.home && input.standings.away),
    h2h_count: h2hCount,
    is_friendly: friendly,
    availability,
    insufficient_data:
      availability.form === "unavailable" && availability.standings === "unavailable" && availability.head_to_head === "unavailable",
    notes,
  };
}

/** Dossier insuffisant (champ calculé, ou recalculé pour les dossiers antérieurs au prompt v4). */
export function isInsufficientData(summary: MatchSummary): boolean {
  if (typeof summary.data_quality.insufficient_data === "boolean") return summary.data_quality.insufficient_data;
  const formKnown = (summary.home.last5?.length ?? 0) >= 3 || (summary.away.last5?.length ?? 0) >= 3;
  return !formKnown && !summary.data_quality.has_standings && summary.data_quality.h2h_count === 0;
}

/**
 * Historique « trop mince » (section 8 : confiance high interdite) :
 * moins de 2 confrontations ET pas de classement, ou forme inconnue d'une équipe.
 */
export function isThinHistory(summary: MatchSummary): boolean {
  const formKnown = (summary.home.last5?.length ?? 0) >= 3 && (summary.away.last5?.length ?? 0) >= 3;
  return !formKnown || (summary.data_quality.h2h_count < 2 && !summary.data_quality.has_standings);
}

/**
 * Statistiques corners / cartons trop minces (lot B, décision 3) : moins de
 * MIN_STATS_MATCHES matchs avec statistiques pour l'une des équipes. Les
 * marchés corners et cartons restent proposés, avec une confiance « low » imposée.
 */
export function isThinMatchStats(summary: MatchSummary): boolean {
  return (summary.home.match_stats?.matches ?? 0) < MIN_STATS_MATCHES || (summary.away.match_stats?.matches ?? 0) < MIN_STATS_MATCHES;
}
