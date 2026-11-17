"use server";

import { z } from "zod";
import { buildMatchContext } from "@/lib/ai/context/build";
import { generateForFixture } from "@/lib/ai/pipeline";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { runJob } from "@/lib/sync/runner";

export type RegenerateResult = { ok: true; saved: number; runId: number | null } | { ok: false; error: string };

/**
 * Régénération des pronostics d'un match par un administrateur (section 8,
 * « Actions de l'admin »). Refusée s'il existe au moins un déblocage (RG-F5-6).
 * L'ancienne version est archivée dans prediction_revisions (par la fonction
 * SQL save_ai_generation), le dossier est reconstruit, l'action journalisée.
 * Sera branchée à /admin/matchs/[id] en phase 10.
 */
export async function regeneratePredictions(fixtureId: number, reason?: string): Promise<RegenerateResult> {
  const admin = await requireAdmin();
  const id = z.number().int().positive().safeParse(fixtureId);
  if (!id.success) return { ok: false, error: "Identifiant de match invalide." };

  const db = createAdminClient();

  // Contrôle préalable (la fonction SQL le revérifie dans la transaction).
  const { count, error: unlockError } = await db
    .from("unlocks")
    .select("id", { count: "exact", head: true })
    .eq("fixture_id", id.data);
  if (unlockError) return { ok: false, error: unlockError.message };
  if ((count ?? 0) > 0) return { ok: false, error: "Régénération impossible : ce match a déjà été acheté (RG-F5-6)." };

  let saved = 0;
  let failure: string | null = null;
  const summary = await runJob("regenerate-predictions", async (ctx) => {
    await buildMatchContext(ctx.db, ctx.api, id.data);
    const result = await generateForFixture(ctx.db, id.data, {
      mode: "regenerate",
      changedBy: admin.id,
      reason: reason?.slice(0, 500) || "Régénération demandée par un administrateur",
    });
    if (result.ok) {
      saved = result.saved;
      ctx.processed(1);
    } else {
      failure = [result.error, ...result.errors].join(" ; ");
      ctx.error(failure);
    }
  }, { db, timeBudgetMs: 120_000 });

  await db.from("admin_audit_log").insert({
    admin_id: admin.id,
    action: "regenerate_predictions",
    entity: "fixtures",
    entity_id: String(id.data),
    after: { status: summary.status, saved, api_calls: summary.apiCalls, error: failure },
    reason: reason?.slice(0, 500) ?? null,
  });

  return failure ? { ok: false, error: failure } : { ok: true, saved, runId: summary.runId };
}
