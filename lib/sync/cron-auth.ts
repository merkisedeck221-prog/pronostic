import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Vérifie l'en-tête « Authorization: Bearer <CRON_SECRET> » en temps constant.
 * Les deux valeurs sont hachées (SHA-256) avant comparaison : la durée ne
 * dépend ni du contenu ni de la longueur de la valeur reçue.
 */
export function isAuthorizedCronRequest(authorizationHeader: string | null, secret: string): boolean {
  if (!secret || secret.length < 32) return false;
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  const received = createHash("sha256").update(authorizationHeader ?? "").digest();
  return timingSafeEqual(expected, received);
}
