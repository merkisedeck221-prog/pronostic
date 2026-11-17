import "server-only";

import { teamRefToRow } from "@/lib/api-football/convert";
import type { DB } from "./runner";

type TeamRef = { id: number; name: string; logo?: string | null };

/**
 * Crée à la volée les équipes absentes (match ou classement) et renvoie la
 * correspondance api_team_id → id interne. Les équipes déjà connues ne sont
 * pas modifiées (sync-competitions s'occupe de leurs informations complètes).
 */
export async function ensureTeams(db: DB, refs: TeamRef[], isNational: boolean): Promise<Map<number, number>> {
  const unique = new Map<number, TeamRef>();
  for (const ref of refs) unique.set(ref.id, ref);
  const apiIds = [...unique.keys()];
  const map = new Map<number, number>();
  if (apiIds.length === 0) return map;

  const { data: existing, error } = await db.from("teams").select("id, api_team_id").in("api_team_id", apiIds);
  if (error) throw new Error(`teams (lecture) : ${error.message}`);
  for (const row of existing ?? []) map.set(row.api_team_id, row.id);

  const missing = apiIds.filter((id) => !map.has(id)).map((id) => teamRefToRow(unique.get(id)!, isNational));
  if (missing.length > 0) {
    const { data: inserted, error: insertError } = await db
      .from("teams")
      .upsert(missing, { onConflict: "api_team_id", ignoreDuplicates: true })
      .select("id, api_team_id");
    if (insertError) throw new Error(`teams (création) : ${insertError.message}`);
    for (const row of inserted ?? []) map.set(row.api_team_id, row.id);

    // Création concurrente possible : relecture des manquantes.
    const stillMissing = apiIds.filter((id) => !map.has(id));
    if (stillMissing.length > 0) {
      const { data: reread } = await db.from("teams").select("id, api_team_id").in("api_team_id", stillMissing);
      for (const row of reread ?? []) map.set(row.api_team_id, row.id);
    }
  }
  return map;
}
