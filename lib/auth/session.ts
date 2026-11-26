import "server-only";

import { headers } from "next/headers";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { HAD_SESSION_HEADER, PATHNAME_HEADER } from "@/lib/auth/constants";
import { loginUrl } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

/**
 * Utilitaires serveur d'authentification (Data Access Layer).
 * Toutes les vérifications se font côté serveur, jamais dans le navigateur.
 */

export type Profile = Tables<"profiles">;

export type CurrentUser = {
  id: string;
  email: string;
  profile: Profile;
};


export class BannedAccountError extends Error {
  constructor() {
    super("Ce compte est suspendu.");
    this.name = "BannedAccountError";
  }
}

/**
 * Utilisateur connecté et son profil, ou null.
 * getUser() interroge Supabase Auth : le jeton est vérifié côté serveur.
 * Mis en cache pour la durée d'UNE requête (React cache), jamais entre requêtes.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Toujours rendu à la requête : une page qui dépend de la session ne doit jamais
  // être pré-rendue au build (même si Supabase n'est pas encore configuré).
  await connection();

  let supabase;
  try {
    supabase = await createClient();
  } catch (error) {
    // Variables Supabase absentes : aucun utilisateur ne peut être connecté.
    console.error("[auth] Client Supabase indisponible :", (error as Error).message);
    return null;
  }

  let user;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    user = data.user;
  } catch (error) {
    // Cookie de session illisible ou corrompu : traité comme une session absente.
    console.error("[auth] Session illisible :", (error as Error).message);
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (profileError || !profile) {
    console.error("[auth] Profil introuvable pour l'utilisateur", user.id, profileError?.message);
    return null;
  }

  return { id: user.id, email: user.email ?? "", profile };
});

/** Chemin demandé par le navigateur (posé par proxy.ts), pour revenir après connexion. */
export async function getRequestedPath(): Promise<string | null> {
  return (await headers()).get(PATHNAME_HEADER);
}

/**
 * Exige une session. Sans session : redirection vers /connexion?next=<page demandée>.
 * Compte suspendu (RG-F1-2) : lève BannedAccountError, sauf si allowBanned
 * (utilisé par la mise en page pour afficher le message de suspension).
 */
/** Un cookie de session Supabase existe mais n'est plus valide : session expirée (message dédié à la connexion). */
async function hadSession(): Promise<boolean> {
  // Posé par proxy.ts avant le rafraîchissement de session (cookie expiré ou corrompu effacé ensuite).
  return (await headers()).get(HAD_SESSION_HEADER) === "1";
}

export async function requireUser(options: { allowBanned?: boolean } = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(loginUrl(await getRequestedPath(), { expired: await hadSession() }));
  if (user.profile.is_banned && !options.allowBanned) throw new BannedAccountError();
  return user;
}

/**
 * Exige le rôle admin, vérifié côté serveur par la fonction SQL is_admin()
 * (rôle admin ET compte non suspendu). Sinon : 404, pour ne pas révéler l'espace admin.
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) notFound();

  const supabase = await createClient();
  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error || isAdmin !== true) notFound();

  return user;
}
