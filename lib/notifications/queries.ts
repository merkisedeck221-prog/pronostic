import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

/**
 * Notifications de l'utilisateur connecté. Lecture par la session (RLS :
 * uniquement les siennes). Écriture : déclencheurs SQL uniquement.
 */
export type NotificationRow = Pick<Tables<"notifications">, "id" | "kind" | "title" | "body" | "link" | "read_at" | "created_at">;

export const NOTIFICATIONS_LIMIT = 50;

export async function countUnreadNotifications(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) {
    console.error("[notifications] compteur :", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function listNotifications(userId: string): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, title, body, link, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(NOTIFICATIONS_LIMIT);
  if (error) throw new Error(`Notifications indisponibles : ${error.message}`);
  return data ?? [];
}
