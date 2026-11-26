/**
 * Adresse publique du site pour les métadonnées (liens absolus, Open Graph,
 * sitemap). Priorité : NEXT_PUBLIC_APP_URL (domaine définitif), puis l'adresse
 * de production fournie automatiquement par Vercel, puis l'adresse locale.
 * Aucune valeur secrète.
 */
export function siteUrl(): URL {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined,
    "http://localhost:3000",
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return new URL(candidate);
    } catch {
      // adresse mal formée : on passe à la suivante
    }
  }
  return new URL("http://localhost:3000");
}

export const SITE_NAME = "PRONEX";
export const SITE_TAGLINE = "Prédisez. Analysez. Dominez.";
export const SITE_DESCRIPTION =
  "PRONEX : pronostics football assistés par intelligence artificielle. Analyses match par match, probabilités, niveaux de confiance et performances publiées en toute transparence.";
