import "server-only";

import type { Json } from "@/types/database";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Journal d'audit (RG-F9-1) pour les actions faites par la RLS admin :
 * fonction SQL admin_log_action (auteur = auth.uid(), contrôle is_admin()).
 */
export async function logAdminAction(
  supabase: Client,
  entry: { action: string; entity: string; entityId?: string | number | null; before?: unknown; after?: unknown; reason?: string | null },
): Promise<void> {
  const { error } = await supabase.rpc("admin_log_action", {
    p_action: entry.action,
    p_entity: entry.entity,
    p_entity_id: entry.entityId === null || entry.entityId === undefined ? (null as unknown as string) : String(entry.entityId),
    p_before: (entry.before ?? null) as Json,
    p_after: (entry.after ?? null) as Json,
    p_reason: entry.reason ?? undefined,
  });
  if (error) console.error("[admin] journal d'audit non écrit :", error.message);
}
