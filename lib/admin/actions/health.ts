"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { failure, isOk, sqlFailure, success, type AdminActionState } from "../result";

/** « Relancer la vérification » : surveillance quotidienne à la demande (journalisée en SQL). */
export async function runHealthCheckAction(): Promise<AdminActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_run_health_check");
  if (error) return failure(error.message);
  if (!isOk(data)) return sqlFailure(data);
  revalidatePath("/admin");
  const anomalies = (data as { anomalies?: unknown[] }).anomalies ?? [];
  return success(anomalies.length === 0 ? "Aucune anomalie." : `${anomalies.length} anomalie(s) détectée(s).`);
}
