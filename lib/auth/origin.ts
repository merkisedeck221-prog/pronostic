import "server-only";

import { headers } from "next/headers";

/**
 * Origine publique de la requête (ex. https://pronostic-git-xxx.vercel.app),
 * utilisée pour les liens envoyés par e-mail (confirmation, réinitialisation).
 * Fonctionne sur chaque URL de prévisualisation Vercel. Supabase n'accepte de
 * toute façon que les adresses de sa liste « Redirect URLs ».
 */
export async function getRequestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
