import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { PATHNAME_HEADER } from "@/lib/auth/constants";
import type { Database } from "@/types/database";

/**
 * Rafraîchit la session Supabase à chaque requête (appelé par proxy.ts).
 *
 * - Les cookies de session renouvelés sont écrits à la fois sur la requête
 *   (pour les composants serveur de cette requête) et sur la réponse (navigateur).
 * - Ajoute l'en-tête x-pathname (chemin demandé) pour le paramètre ?next=.
 *   Toute valeur envoyée par le client est écrasée.
 * - Aucune redirection ici : la protection des pages est faite par les mises en
 *   page (app/(app), app/admin), côté serveur.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const requestedPath = request.nextUrl.pathname + request.nextUrl.search;

  const forwardedHeaders = () => {
    const h = new Headers(request.headers);
    h.set(PATHNAME_HEADER, requestedPath);
    return h;
  };

  let response = NextResponse.next({ request: { headers: forwardedHeaders() } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response; // Supabase non configuré : pas de session possible.

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request: { headers: forwardedHeaders() } });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // IMPORTANT : ne rien exécuter entre createServerClient et getClaims().
  // getClaims() vérifie le jeton et le renouvelle s'il a expiré.
  try {
    await supabase.auth.getClaims();
  } catch (error) {
    console.error("[proxy] Rafraîchissement de session impossible :", (error as Error).message);
  }

  return response;
}
