import "server-only";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Compteurs publics de la landing, calculés par la base (get_public_counters)
 * à partir de données réelles uniquement. null = indicateur masqué (sous le
 * seuil d'affichage, ou donnée indisponible) : jamais de chiffre inventé.
 */
const countSchema = z.number().int().nonnegative().nullable().catch(null);
export const publicCountersSchema = z.object({ users: countSchema, won: countSchema, analyses: countSchema });
export type PublicCounters = z.infer<typeof publicCountersSchema>;

export const NO_COUNTERS: PublicCounters = { users: null, won: null, analyses: null };

export async function getPublicCounters(): Promise<PublicCounters> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_public_counters");
    if (error) return NO_COUNTERS;
    const parsed = publicCountersSchema.safeParse(data);
    return parsed.success ? parsed.data : NO_COUNTERS;
  } catch {
    return NO_COUNTERS;
  }
}
