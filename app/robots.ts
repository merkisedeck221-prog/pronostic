import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo/site";

/** Pages publiques indexables ; espace connecté, administration et API exclus. */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/",
        "/auth/",
        "/tableau-de-bord",
        "/matchs",
        "/competitions",
        "/mes-pronostics",
        "/portefeuille",
        "/recharger",
        "/notifications",
        "/profil",
        "/reinitialiser-mot-de-passe",
      ],
    },
    sitemap: new URL("/sitemap.xml", base).toString(),
    host: base.origin,
  };
}
