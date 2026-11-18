/**
 * Garde-fou : les tests d'intégration et de bout en bout créent et suppriment
 * des données. Ils ne doivent JAMAIS viser la base de PRODUCTION.
 * Projet de production : « pronostics » (réf. pgeytactmugqskdzsxnw), décision
 * de la phase 12. Pour lancer ces tests, créer un projet Supabase de
 * développement séparé et renseigner son URL.
 */
export const PRODUCTION_PROJECT_REFS = ["pgeytactmugqskdzsxnw"] as const;

export function assertNotProduction(url: string | undefined): void {
  if (!url) return;
  const target = PRODUCTION_PROJECT_REFS.find((ref) => url.includes(ref));
  if (target) {
    throw new Error(
      `Tests refusés : ${url} est la base de PRODUCTION (${target}). Utilisez un projet Supabase de développement séparé.`,
    );
  }
}
