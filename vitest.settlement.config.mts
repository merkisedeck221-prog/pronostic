import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/** Tests d'intégration de la résolution (tests/settlement/), projet Supabase de DÉVELOPPEMENT uniquement. */
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/settlement/**/*.test.ts"],
    env: loadEnv(mode, process.cwd(), ""),
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
}));
