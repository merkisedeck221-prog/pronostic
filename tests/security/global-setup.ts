import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";

/**
 * Démarre l'application compilée (next start) pour les tests HTTP de sécurité.
 * Prérequis : `npm run build` avec les variables Supabase du projet de DEV.
 * Si APP_BASE_URL est défini, on utilise ce serveur et on n'en démarre aucun.
 */
export const TEST_APP_PORT = process.env.TEST_APP_PORT ?? "3210";

export default async function setup() {
  if (process.env.APP_BASE_URL) return;

  if (!existsSync(".next/BUILD_ID")) {
    throw new Error("Application non compilée : lancez `npm run build` (avec .env.local du projet DEV) avant `npm run test:security`.");
  }

  const child: ChildProcess = spawn("npx", ["next", "start", "-p", TEST_APP_PORT], {
    env: process.env,
    stdio: ["ignore", "inherit", "inherit"],
  });

  const url = `http://localhost:${TEST_APP_PORT}/cgu`;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) break;
    } catch {
      // serveur pas encore prêt
    }
    if (attempt === 59) {
      child.kill();
      throw new Error(`Le serveur de test ne répond pas sur ${url}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return () => {
    child.kill();
  };
}
