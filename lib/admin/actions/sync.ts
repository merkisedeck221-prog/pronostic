"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { runSyncJobAction } from "@/lib/sync/actions";
import { failure, success, type AdminActionState } from "../result";

/** Lancement manuel d'une tâche (RG-F9-3) : résultat affiché ; journalisé par runSyncJobAction. */
export async function adminRunSyncJobAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const job = String(formData.get("job") ?? "");
  const result = await runSyncJobAction(job);
  revalidatePath("/admin/synchronisation");
  if (!result.ok) return failure(result.error);
  const s = result.summary;
  const errors = s.errors.length > 0 ? ` Erreurs : ${s.errors.slice(0, 3).join(" ; ")}` : "";
  return s.status === "failed"
    ? failure(`${s.job} : échec.${errors}`)
    : success(`${s.job} : ${s.status}, ${s.itemsProcessed} éléments, ${s.apiCalls} appel(s) API, ${Math.round(s.durationMs / 100) / 10} s.${errors}`);
}
