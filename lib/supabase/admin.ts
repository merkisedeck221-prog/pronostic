import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getClientEnv, getServerEnv } from "@/lib/env";

/**
 * Client Supabase ADMINISTRATEUR (clé secrète `SUPABASE_SERVICE_ROLE_KEY`).
 *
 * ⚠️ Contourne la RLS. Réservé aux tâches planifiées (`/api/cron/*`) et aux
 * webhooks de paiement. Ne jamais l'utiliser pour servir des données à un
 * utilisateur, ni l'importer dans un composant client (`server-only` l'interdit).
 */
export function createAdminClient() {
  const { NEXT_PUBLIC_SUPABASE_URL } = getClientEnv();
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();

  return createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
