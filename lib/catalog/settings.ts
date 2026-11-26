import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Réglages publics (app_settings.is_public, lisibles sans compte) qui changent
 * un texte affiché. Valeur stricte : un réglage absent ou illisible vaut false,
 * pour ne jamais promettre ce qui n'est pas activé.
 */
export type PublicFlags = { refundOnCancel: boolean; revealAfterMatch: boolean };

export const getPublicFlags = cache(async (): Promise<PublicFlags> => {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("key, value").in("key", ["refund_on_cancel", "reveal_after_match"]);
  const value = (key: string) => (data ?? []).find((row) => row.key === key)?.value === true;
  return { refundOnCancel: value("refund_on_cancel"), revealAfterMatch: value("reveal_after_match") };
});
