import { z } from "zod";

/**
 * Validation des variables d'environnement (cahier des charges, section 9).
 *
 * - Variables CLIENT : utilisables partout (navigateur et serveur). Les variables
 *   `NEXT_PUBLIC_*` sont incluses dans le bundle navigateur au moment du build ;
 *   `DEFAULT_TIMEZONE` y est exposée via `next.config.ts`.
 * - Variables SERVEUR : secrets et réglages internes. `getServerEnv()` refuse de
 *   s'exécuter dans le navigateur.
 *
 * La validation est paresseuse (au premier appel) pour que `next build` ne
 * plante pas tant que les variables ne sont pas encore renseignées sur Vercel.
 * Une chaîne vide est traitée comme une variable absente.
 */

const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const required = () => z.preprocess(blankToUndefined, z.string({ error: "obligatoire" }).min(1));
const requiredUrl = () => z.preprocess(blankToUndefined, z.url({ error: "obligatoire (URL valide)" }));
const intWithDefault = (fallback: number) =>
  z.preprocess(blankToUndefined, z.coerce.number().int().positive().default(fallback));

export const DEFAULT_TIMEZONE_FALLBACK = "Africa/Porto-Novo";

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: requiredUrl(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: required(),
  // Facultative : l'origine des liens envoyés par e-mail est lue sur la requête
  // (lib/auth/origin.ts) ; cette valeur ne sert que de repli.
  NEXT_PUBLIC_APP_URL: z.preprocess(blankToUndefined, z.url({ error: "URL valide attendue" }).optional()),
  DEFAULT_TIMEZONE: z.preprocess(blankToUndefined, z.string().default(DEFAULT_TIMEZONE_FALLBACK)),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: required(),
  API_FOOTBALL_KEY: required(),
  API_FOOTBALL_DAILY_BUDGET: intWithDefault(90),
  OPENAI_API_KEY: required(),
  OPENAI_MODEL: required(),
  AI_DAILY_GENERATION_LIMIT: intWithDefault(20),
  CRON_SECRET: z.preprocess(
    blankToUndefined,
    z.string({ error: "obligatoire" }).min(32, { error: "32 caractères minimum" }),
  ),
  ADMIN_EMAILS: z.preprocess(
    blankToUndefined,
    z
      .string()
      .default("")
      .transform((value) =>
        value
          .split(",")
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      )
      .pipe(z.array(z.email({ error: "liste d'e-mails séparés par des virgules" }))),
  ),
  PAYMENT_PROVIDER: z.preprocess(blankToUndefined, z.enum(["mock"]).default("mock")),
});

export type ClientEnv = z.infer<typeof clientSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

type EnvSource = Record<string, string | undefined>;

function formatIssues(scope: string, error: z.ZodError): string {
  const lines = error.issues.map((issue) => `  - ${issue.path.join(".")} : ${issue.message}`);
  return [
    `Variables d'environnement ${scope} manquantes ou invalides :`,
    ...lines,
    "Renseignez-les dans .env.local (en local) ou dans les réglages du projet Vercel (voir .env.example).",
  ].join("\n");
}

export function parseClientEnv(source: EnvSource): ClientEnv {
  const result = clientSchema.safeParse(source);
  if (!result.success) throw new Error(formatIssues("client", result.error));
  return result.data;
}

export function parseServerEnv(source: EnvSource): ServerEnv {
  const result = serverSchema.safeParse(source);
  if (!result.success) throw new Error(formatIssues("serveur", result.error));
  return result.data;
}

let clientEnvCache: ClientEnv | undefined;
let serverEnvCache: ServerEnv | undefined;

/** Variables publiques, utilisables dans le navigateur comme sur le serveur. */
export function getClientEnv(): ClientEnv {
  clientEnvCache ??= parseClientEnv({
    // Accès explicites : obligatoires pour que Next.js les inclue dans le bundle navigateur.
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE,
  });
  return clientEnvCache;
}

type ServerKey = keyof ServerEnv;

/**
 * Valide uniquement les variables serveur demandées. Permet à une fonctionnalité
 * (ex. promotion admin) de fonctionner sans exiger les clés d'une autre (ex. OpenAI).
 */
export function parseServerEnvKeys<K extends ServerKey>(
  source: EnvSource,
  keys: readonly K[],
): Pick<ServerEnv, K> {
  // Casts : le typage générique de .pick() ne suit pas un K générique ; le
  // résultat est bien validé par le sous-schéma correspondant aux clés demandées.
  const mask = Object.fromEntries(keys.map((key) => [key, true])) as never;
  const result = serverSchema.pick(mask).safeParse(source);
  if (!result.success) throw new Error(formatIssues("serveur", result.error));
  return result.data as unknown as Pick<ServerEnv, K>;
}

/** Variables secrètes demandées : serveur uniquement. */
export function getServerEnvKeys<K extends ServerKey>(keys: readonly K[]): Pick<ServerEnv, K> {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnvKeys() ne doit jamais être appelé dans le navigateur.");
  }
  return parseServerEnvKeys(process.env, keys);
}

/** Toutes les variables secrètes : serveur uniquement. */
export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv() ne doit jamais être appelé dans le navigateur.");
  }
  serverEnvCache ??= parseServerEnv(process.env);
  return serverEnvCache;
}
