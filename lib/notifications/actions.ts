"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Marque toutes les notifications de l'utilisateur connecté comme lues.
 * Aucun paramètre : la fonction SQL s'appuie sur auth.uid() (règle 5).
 */
export async function markAllNotificationsReadAction(): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_notifications_read", {});
  if (error) console.error("[notifications] marquer lues :", error.message);
  revalidatePath("/", "layout");
}
