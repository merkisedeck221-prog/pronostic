/** Lien interne sûr : chemin relatif commençant par « / » (jamais « // », « \ » ni URL externe). */
export function safeNotificationLink(link: string | null): string | null {
  if (!link || !link.startsWith("/") || link.startsWith("//") || link.includes("\\")) return null;
  return link;
}
