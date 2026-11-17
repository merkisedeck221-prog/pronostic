import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // DEFAULT_TIMEZONE est utilisée côté client et serveur (section 9) sans préfixe NEXT_PUBLIC_ :
  // on l'expose explicitement au bundle navigateur (valeur non sensible).
  env: {
    DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE || "Africa/Porto-Novo",
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
