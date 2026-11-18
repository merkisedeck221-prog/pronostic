import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

/**
 * Tests de bout en bout (tests/e2e/) contre l'application compilée et le
 * projet Supabase de DÉVELOPPEMENT. Prérequis : `npm run build` avec les
 * variables du projet DEV (dont SUPABASE_SERVICE_ROLE_KEY et
 * PAYMENT_MOCK_SECRET). APP_BASE_URL permet de viser un serveur déjà lancé.
 */
loadEnvConfig(process.cwd());

const port = Number(process.env.E2E_PORT ?? 3230);
const baseURL = process.env.APP_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    locale: "fr-FR",
    timezoneId: "Africa/Porto-Novo",
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.APP_BASE_URL
    ? undefined
    : {
        command: `npx next start -p ${port}`,
        url: `${baseURL}/cgu`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
