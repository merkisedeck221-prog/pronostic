import { z } from "zod";

/**
 * Étapes RÉELLES d'une génération à la demande (colonne generation_requests.stage,
 * écrite par le serveur au début de chaque phase) et correspondance avec les
 * 7 étapes visuelles de l'animation PRONEX AI. Fonctions pures, testées.
 *
 * Règle : une étape n'est « terminée » que si le serveur est passé à une phase
 * suivante ; le « Résultat final » n'est atteint qu'au statut « succeeded »
 * (analyse validée, enregistrée et accès donné). Aucune progression simulée.
 */

export const SERVER_STAGES = ["starting", "fixture", "context", "ai", "validating", "saving", "waiting"] as const;
export type ServerStage = (typeof SERVER_STAGES)[number];

export const VISUAL_STEPS = [
  { key: "init", title: "Initialisation du moteur PRONEX AI", detail: "Démarrage du moteur et réservation de vos crédits." },
  { key: "fixture", title: "Recherche de la rencontre", detail: "Vérification du match et de sa disponibilité." },
  { key: "stats", title: "Analyse des statistiques", detail: "Forme, classement, confrontations et statistiques disponibles." },
  { key: "markets", title: "Évaluation des marchés", detail: "PRONEX AI étudie les 13 types de pronostics." },
  { key: "risk", title: "Évaluation du risque", detail: "Contrôle des probabilités, des niveaux de confiance et de la cohérence." },
  { key: "combo", title: "Construction de la combinaison", detail: "Enregistrement du jeu de pronostics, Combiné IA du même match compris." },
  { key: "result", title: "Résultat final", detail: "Analyse validée : vos pronostics sont prêts." },
] as const;

export type StepState = "done" | "active" | "pending" | "shared" | "failed";
export type RequestStatus = "reserved" | "running" | "succeeded" | "failed";

/** Index (0 à 6) de l'étape visuelle en cours pour une phase serveur. */
const ACTIVE_STEP: Record<ServerStage, number> = {
  starting: 0,
  fixture: 1,
  context: 2,
  ai: 3,
  validating: 4,
  saving: 5,
  waiting: 2,
};

export type ProgressView = {
  steps: StepState[];
  /** Étapes terminées (0 à 7), pour la barre de progression : jamais d'avance simulée. */
  completed: number;
  /** Une autre demande du même match génère l'analyse : étapes 3 à 6 non observables d'ici. */
  shared: boolean;
  finished: boolean;
  failed: boolean;
};

export function progressView(status: RequestStatus, stage: ServerStage | null): ProgressView {
  if (status === "succeeded") {
    return { steps: VISUAL_STEPS.map(() => "done"), completed: VISUAL_STEPS.length, shared: false, finished: true, failed: false };
  }
  const active = stage ? ACTIVE_STEP[stage] : 0;
  const shared = stage === "waiting";
  const steps: StepState[] = VISUAL_STEPS.map((_, index) => {
    if (index < active) return "done";
    if (shared && index >= 2 && index <= 5) return "shared";
    if (index === active) return status === "failed" ? "failed" : "active";
    return "pending";
  });
  if (status === "failed" && !steps.includes("failed")) steps[active] = "failed";
  return { steps, completed: active, shared, finished: false, failed: status === "failed" };
}

/** Réponse de la route de suivi (lecture avec la session : demandes de l'utilisateur uniquement). */
export const generationProgressSchema = z.object({
  status: z.enum(["reserved", "running", "succeeded", "failed"]),
  stage: z.enum(SERVER_STAGES).nullable(),
  marketCode: z.string().nullable(),
});
export type GenerationProgress = z.infer<typeof generationProgressSchema>;
