import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Outils communs aux scripts lancés à la main (tsx) :
 * chargement de .env.local et enregistrement des réponses API brutes.
 */

/** Charge .env.local (sans écraser les variables déjà définies, ex. en CI). */
export function loadDotEnvLocal(path = ".env.local"): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, raw] = match;
    const value = raw.replace(/^["']|["']$/g, "");
    if (value !== "" && process.env[key] === undefined) process.env[key] = value;
  }
}

/**
 * fetch qui enregistre chaque réponse JSON d'API-Football dans `dir`
 * (pour constituer des réponses de test réelles, sans nouvel appel ensuite).
 * La clé API n'est jamais écrite : seuls l'URL (sans en-têtes) et le corps le sont.
 */
export function recordingFetch(dir: string): typeof fetch {
  let counter = 0;
  return async (input, init) => {
    const response = await fetch(input, init);
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const body = await response.clone().text();
    counter += 1;
    const name = `${String(counter).padStart(2, "0")}${url.pathname.replace(/\//g, "_")}_${[...url.searchParams.entries()]
      .filter(([key]) => key !== "timezone")
      .map(([key, value]) => `${key}-${value}`)
      .join("_")
      .replace(/[^a-zA-Z0-9_.-]/g, "")
      .slice(0, 80)}.json`;
    const file = join(dir, name);
    mkdirSync(dirname(file), { recursive: true });
    try {
      writeFileSync(file, JSON.stringify({ url: `${url.pathname}${url.search}`, status: response.status, body: JSON.parse(body) }, null, 2));
    } catch {
      writeFileSync(file, JSON.stringify({ url: `${url.pathname}${url.search}`, status: response.status, raw: body }, null, 2));
    }
    return response;
  };
}
