import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // `server-only` lève une erreur hors du bundler Next.js : neutralisé pour les tests unitaires.
      "server-only": fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", ".next", "e2e", "tests/security/**", "tests/credits/**", "tests/payments/**", "tests/settlement/**", "tests/admin/**"],
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts"],
    },
  },
});
