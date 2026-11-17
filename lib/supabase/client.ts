import { createBrowserClient } from "@supabase/ssr";
import { getClientEnv } from "@/lib/env";

/**
 * Client Supabase pour le NAVIGATEUR (composants client).
 * N'utilise que la clé publique : toute la sécurité repose sur la RLS.
 */
export function createClient() {
  const env = getClientEnv();
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
