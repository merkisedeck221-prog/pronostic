import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Tests d'intégration de sécurité (tests/security/) : ils s'exécutent contre le
 * projet Supabase de DÉVELOPPEMENT, jamais contre la production.
 * Variables lues dans .env.local (ou dans l'environnement, ex. CI) :
 * NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
 */
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/security/**/*.test.ts"],
    env: loadEnv(mode, process.cwd(), ""),
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Les fichiers partagent la même base : exécution séquentielle.
    fileParallelism: false,
  },
}));
