import "server-only";

import type { z } from "zod";
import { envelopeSchema } from "./schemas";

/**
 * Client HTTP typé pour API-Football v3 (serveur uniquement).
 *
 * - En-tête x-apisports-key ; toutes les heures demandées en UTC (timezone=UTC
 *   ajouté automatiquement sur les endpoints qui l'acceptent).
 * - Délai maximal de 15 s par tentative ; 2 nouvelles tentatives avec attente
 *   progressive (erreurs réseau, 429, 5xx).
 * - Garde-fou budgétaire AVANT chaque appel (BudgetGuard).
 * - Lecture du quota restant (en-têtes) et du champ `errors` du corps
 *   (l'API peut répondre 200 avec des erreurs).
 */

export const API_FOOTBALL_BASE_URL = "https://v3.football.api-sports.io";

/** Endpoints qui acceptent le paramètre timezone. */
const TIMEZONE_ENDPOINTS = new Set(["/fixtures", "/fixtures/headtohead"]);

export class ApiFootballError extends Error {
  constructor(
    message: string,
    readonly details: { endpoint: string; status?: number; apiErrors?: unknown } = { endpoint: "" },
  ) {
    super(message);
    this.name = "ApiFootballError";
  }
}

export class BudgetExceededError extends Error {
  constructor(readonly used: number, readonly limit: number) {
    super(`Budget quotidien API-Football atteint (${used}/${limit} appels aujourd'hui) : appel refusé.`);
    this.name = "BudgetExceededError";
  }
}

/**
 * Comptabilité des appels. `usedToday()` doit inclure les appels déjà
 * enregistrés aujourd'hui (UTC) ; `record()` est appelé après CHAQUE requête
 * réellement envoyée (y compris en échec), avant toute nouvelle tentative.
 */
export interface BudgetStore {
  usedToday(): Promise<number>;
  record(calls: number): Promise<void>;
}

/** Garde-fou : refuse l'appel si le budget du jour est atteint. */
export class BudgetGuard {
  constructor(
    private readonly store: BudgetStore,
    readonly dailyLimit: number,
  ) {}

  async assertCanCall(): Promise<void> {
    const used = await this.store.usedToday();
    if (used >= this.dailyLimit) throw new BudgetExceededError(used, this.dailyLimit);
  }

  record(calls = 1): Promise<void> {
    return this.store.record(calls);
  }
}

export type QuotaInfo = {
  /** Requêtes restantes aujourd'hui selon API-Football (x-ratelimit-requests-remaining). */
  dailyRemaining: number | null;
  dailyLimit: number | null;
  /** Requêtes restantes dans la minute (x-ratelimit-remaining). */
  minuteRemaining: number | null;
};

export type ApiFootballResult<T> = {
  data: T;
  results: number;
  paging?: { current?: number; total?: number };
  quota: QuotaInfo;
};

export type ApiFootballClientOptions = {
  apiKey: string;
  budget: BudgetGuard;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retries?: number;
  /** Attente avant la tentative n (1, 2…) ; injectable pour les tests. */
  sleep?: (ms: number) => Promise<void>;
  baseUrl?: string;
};

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function toNumber(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function readQuota(headers: Headers): QuotaInfo {
  return {
    dailyRemaining: toNumber(headers.get("x-ratelimit-requests-remaining")),
    dailyLimit: toNumber(headers.get("x-ratelimit-requests-limit")),
    minuteRemaining: toNumber(headers.get("x-ratelimit-remaining")),
  };
}

/** Normalise le champ errors (tableau vide = pas d'erreur). */
export function apiErrorsMessage(errors: unknown): string | null {
  if (!errors) return null;
  if (Array.isArray(errors)) return errors.length ? errors.map(String).join(" ; ") : null;
  if (typeof errors === "object") {
    const entries = Object.entries(errors as Record<string, unknown>);
    return entries.length ? entries.map(([key, value]) => `${key}: ${String(value)}`).join(" ; ") : null;
  }
  return String(errors);
}

export class ApiFootballClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly baseUrl: string;
  /** Dernier quota connu (mis à jour à chaque réponse). */
  lastQuota: QuotaInfo = { dailyRemaining: null, dailyLimit: null, minuteRemaining: null };
  /** Nombre de requêtes HTTP envoyées par ce client. */
  callCount = 0;

  constructor(private readonly options: ApiFootballClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.retries = options.retries ?? 2;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.baseUrl = options.baseUrl ?? API_FOOTBALL_BASE_URL;
  }

  /**
   * Appelle un endpoint et valide `response` avec le schéma fourni.
   * Lève BudgetExceededError (budget du jour atteint) ou ApiFootballError.
   */
  async get<S extends z.ZodType>(
    endpoint: string,
    params: Record<string, string | number | undefined>,
    schema: S,
  ): Promise<ApiFootballResult<z.infer<S>>> {
    const url = new URL(endpoint, this.baseUrl);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    if (TIMEZONE_ENDPOINTS.has(endpoint) && !url.searchParams.has("timezone") && !url.searchParams.has("ids")) {
      url.searchParams.set("timezone", "UTC");
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      if (attempt > 0) await this.sleep(1000 * 2 ** (attempt - 1)); // 1 s, puis 2 s

      // Garde-fou AVANT chaque requête réellement envoyée (tentatives comprises).
      await this.options.budget.assertCanCall();

      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          method: "GET",
          headers: { "x-apisports-key": this.options.apiKey, accept: "application/json" },
          signal: AbortSignal.timeout(this.timeoutMs),
          cache: "no-store",
        });
      } catch (error) {
        // La requête a pu atteindre le serveur : on la compte.
        this.callCount += 1;
        await this.options.budget.record(1);
        lastError = new ApiFootballError(`Échec réseau ou délai dépassé : ${(error as Error).message}`, { endpoint });
        continue;
      }

      this.callCount += 1;
      await this.options.budget.record(1);
      this.lastQuota = readQuota(response.headers);

      if (RETRYABLE_STATUS.has(response.status)) {
        lastError = new ApiFootballError(`HTTP ${response.status}`, { endpoint, status: response.status });
        continue;
      }
      if (!response.ok) {
        throw new ApiFootballError(`HTTP ${response.status}`, { endpoint, status: response.status });
      }

      const body: unknown = await response.json();
      const envelope = envelopeSchema.safeParse(body);
      if (!envelope.success) {
        throw new ApiFootballError("Réponse API-Football illisible", { endpoint });
      }
      const apiErrors = apiErrorsMessage(envelope.data.errors);
      if (apiErrors) {
        // Erreur fonctionnelle (clé, forfait, quota, paramètre) : pas de nouvelle tentative.
        throw new ApiFootballError(`API-Football : ${apiErrors}`, { endpoint, status: response.status, apiErrors: envelope.data.errors });
      }

      const parsed = schema.safeParse(envelope.data.response);
      if (!parsed.success) {
        throw new ApiFootballError(`Réponse inattendue pour ${endpoint} : ${parsed.error.issues[0]?.message ?? "format"}`, {
          endpoint,
        });
      }
      return {
        data: parsed.data,
        results: envelope.data.results ?? 0,
        paging: envelope.data.paging,
        quota: this.lastQuota,
      };
    }
    throw lastError instanceof Error ? lastError : new ApiFootballError("Échec après plusieurs tentatives", { endpoint });
  }
}
