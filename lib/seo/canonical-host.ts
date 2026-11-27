/**
 * Redirection des anciennes adresses Vercel vers l'adresse officielle
 * (https://pronex.vercel.app depuis le 27/11/2026).
 *
 * - Seules les adresses listées sont redirigées (les déploiements de
 *   prévisualisation et le développement local ne le sont jamais).
 * - /api/* n'est jamais redirigé : Supabase Cron et les webhooks appellent
 *   encore l'ancienne adresse et ne suivent pas les redirections.
 * - /auth/* non plus : un lien d'e-mail envoyé avant le changement doit finir
 *   sur l'adresse où le navigateur a gardé son cookie de connexion.
 */
export const CANONICAL_HOST = "pronex.vercel.app";

export const LEGACY_HOSTS: readonly string[] = [
  "pronostic-brown.vercel.app",
  "pronostic-merkisedeck.vercel.app",
  "pronostic-git-main-merkisedeck.vercel.app",
];

/** URL de destination, ou null s'il ne faut pas rediriger. */
export function canonicalRedirect(host: string | null, pathname: string, search: string): string | null {
  if (!host) return null;
  const bare = host.toLowerCase().split(":")[0];
  if (!LEGACY_HOSTS.includes(bare)) return null;
  if (["/api", "/auth"].some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  return `https://${CANONICAL_HOST}${pathname}${search}`;
}
