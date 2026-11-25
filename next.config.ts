import type { NextConfig } from "next";

/**
 * Politique de sécurité du contenu (CSP). Next.js insère des scripts en ligne
 * pour l'hydratation : 'unsafe-inline' reste nécessaire sans nonce (le nonce
 * imposerait un rendu dynamique de toutes les pages). La CSP limite tout le
 * reste : connexions (Supabase seulement), images, cadres, formulaires,
 * plugins et balise <base>. 'unsafe-eval' uniquement en développement.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseOrigin = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(supabaseUrl.replace(/\/$/, "")) ? supabaseUrl.replace(/\/$/, "") : "https://*.supabase.co";
const isDev = process.env.NODE_ENV !== "production";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://vercel.live`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://media.api-sports.io https://vercel.com https://vercel.live",
  "font-src 'self' data: https://vercel.live",
  `connect-src 'self' ${supabaseOrigin} ${supabaseOrigin.replace("https://", "wss://")} https://vercel.live wss://ws-us3.pusher.com`,
  "frame-src 'self' https://vercel.live",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

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
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
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
