"use server";

import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSyncJob, syncJobNameSchema, type SyncSummary } from "@/lib/sync";

export type RunSyncJobResult = { ok: true; summary: SyncSummary } | { ok: false; error: string };

/**
 * Lancement manuel d'une tâche par un administrateur (RG-F9-3).
 * Rôle vérifié côté serveur ; action journalisée dans admin_audit_log.
 * Sera branchée à /admin/synchronisation en phase 10.
 */
export async function runSyncJobAction(job: string): Promise<RunSyncJobResult> {
  const admin = await requireAdmin();

  const parsed = syncJobNameSchema.safeParse(job);
  if (!parsed.success) return { ok: false, error: "Tâche inconnue." };

  try {
    const summary = await runSyncJob(parsed.data);

    const { error } = await createAdminClient().from("admin_audit_log").insert({
      admin_id: admin.id,
      action: "run_sync_job",
      entity: "sync_runs",
      entity_id: summary.runId === null ? null : String(summary.runId),
      after: { job: summary.job, status: summary.status, api_calls: summary.apiCalls, items: summary.itemsProcessed },
      reason: "Lancement manuel depuis l'administration",
    });
    if (error) console.error("[sync] Journal d'audit non écrit :", error.message);

    return { ok: true, summary };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
