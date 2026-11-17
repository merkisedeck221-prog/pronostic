import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getClientEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Client Supabase SERVEUR avec la session de l'utilisateur (cookies).
 * À utiliser dans les composants serveur, Server Actions et route handlers.
 * Clé publique + session : la RLS s'applique comme pour l'utilisateur connecté.
 */
export async function createClient() {
  const env = getClientEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Appelé depuis un composant serveur : l'écriture de cookies y est interdite.
          // Le rafraîchissement de session sera assuré par le proxy (phase 3).
        }
      },
    },
  });
}
