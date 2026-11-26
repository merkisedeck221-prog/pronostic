/**
 * Gestion sûre du paramètre « next » (page à rouvrir après connexion).
 * Seuls les chemins internes sont acceptés : on évite les redirections ouvertes
 * vers un site externe (//evil.com, https://…, /\evil.com…).
 */

export const DEFAULT_AFTER_LOGIN = "/tableau-de-bord";

export function safeNextPath(next: unknown, fallback: string = DEFAULT_AFTER_LOGIN): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 512) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\\]/.test(next)) return fallback;
  // Ne jamais renvoyer vers les pages d'authentification elles-mêmes.
  if (/^\/(connexion|inscription|auth\/)/.test(next)) return fallback;
  return next;
}

/** URL de la page de connexion avec le paramètre next encodé. */
export function loginUrl(next?: string | null, options: { expired?: boolean } = {}): string {
  const target = safeNextPath(next ?? undefined, "");
  const params = new URLSearchParams();
  if (target) params.set("next", target);
  if (options.expired) params.set("info", "session-expiree");
  const query = params.toString();
  return query ? `/connexion?${query}` : "/connexion";
}
