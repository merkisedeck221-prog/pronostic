import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // DEFAULT_TIMEZONE est utilisée côté client et serveur (section 9) sans préfixe NEXT_PUBLIC_ :
  // on l'expose explicitement au bundle navigateur (valeur non sensible).
  env: {
    DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE || "Africa/Porto-Novo",
  },
  // Cache Components désactivé (phase 3) : l'application est presque entièrement
  // authentifiée ; les contrôles d'accès doivent bloquer le rendu serveur pour
  // renvoyer de vrais 307 / 404, et aucun contenu utilisateur ne doit être mis
  // en cache côté serveur (règle de sécurité n° 8).
  // Logos des équipes et compétitions servis par API-Football (affichés sans
  // optimisation Vercel pour ne pas consommer le quota d'images de l'offre Hobby).
  images: {
    remotePatterns: [{ protocol: "https", hostname: "media.api-sports.io", pathname: "/**" }],
    unoptimized: true,
  },
  // En-têtes de sécurité (phase 11) : pas d'intégration dans un cadre (clickjacking),
  // pas de détection de type MIME, référent limité, API sensibles du navigateur coupées.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
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
