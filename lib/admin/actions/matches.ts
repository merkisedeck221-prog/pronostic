"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { buildMatchContext } from "@/lib/ai/context/build";
import { regeneratePredictions } from "@/lib/ai/actions";
import { generateForFixture } from "@/lib/ai/pipeline";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { runJob } from "@/lib/sync/runner";
import { logAdminAction } from "../audit";
import { failure, isOk, sqlFailure, success, type AdminActionState } from "../result";

const idSchema = z.coerce.number().int().positive();
const reasonSchema = z.string().trim().min(3, "Un motif est obligatoire (3 caractères minimum).").max(500);

function fixturePaths(fixtureId: number) {
  revalidatePath("/admin/matchs");
  revalidatePath(`/admin/matchs/${fixtureId}`);
}

export async function setFixturePublishedAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const input = z.object({ fixtureId: idSchema, published: z.enum(["true", "false"]) }).safeParse(Object.fromEntries(formData));
  if (!input.success) return failure("Requête invalide.");
  const published = input.data.published === "true";

  const supabase = await createClient();
  const { data: before } = await supabase.from("fixtures").select("is_published").eq("id", input.data.fixtureId).maybeSingle();
  if (!before) return failure("Match introuvable.");
  const { error } = await supabase.from("fixtures").update({ is_published: published }).eq("id", input.data.fixtureId);
  if (error) return failure(error.message);
  await logAdminAction(supabase, {
    action: published ? "publish_fixture" : "hide_fixture",
    entity: "fixtures",
    entityId: input.data.fixtureId,
    before,
    after: { is_published: published },
  });
  fixturePaths(input.data.fixtureId);
  return success(published ? "Match publié." : "Match masqué.");
}

export async function setPredictionStatusAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const input = z
    .object({ predictionId: idSchema, fixtureId: idSchema, status: z.enum(["published", "hidden"]), reason: z.string().max(500).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!input.success) return failure("Requête invalide.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_prediction_status", {
    p_prediction_id: input.data.predictionId,
    p_status: input.data.status,
    p_reason: input.data.reason || (input.data.status === "hidden" ? "Masqué par l'administration" : "Réaffiché par l'administration"),
  });
  if (error) return failure(error.message);
  if (!isOk(data)) return sqlFailure(data);
  fixturePaths(input.data.fixtureId);
  return success(input.data.status === "hidden" ? "Marché masqué (les acheteurs le conservent)." : "Marché réaffiché.");
}

export async function editPredictionTextAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const input = z
    .object({ predictionId: idSchema, fixtureId: idSchema, reasoning: z.string().trim().min(20).max(2000), reason: reasonSchema })
    .safeParse(Object.fromEntries(formData));
  if (!input.success) return failure(input.error.issues[0]?.message ?? "Texte invalide (20 à 2 000 caractères).");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_edit_prediction_text", {
    p_prediction_id: input.data.predictionId,
    p_reasoning: input.data.reasoning,
    p_reason: input.data.reason,
  });
  if (error) return failure(error.message);
  if (!isOk(data)) return sqlFailure(data);
  fixturePaths(input.data.fixtureId);
  return success("Explication modifiée (ancienne version historisée).");
}

export async function regenerateFixtureAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const input = z.object({ fixtureId: idSchema, reason: reasonSchema }).safeParse(Object.fromEntries(formData));
  if (!input.success) return failure(input.error.issues[0]?.message ?? "Requête invalide.");
  const result = await regeneratePredictions(input.data.fixtureId, input.data.reason);
  fixturePaths(input.data.fixtureId);
  return result.ok ? success(`Pronostics régénérés (${result.saved} marchés).`) : failure(result.error);
}

/** « Générer maintenant » : dossier + génération initiale, si le match n'a encore aucun pronostic. */
export async function generateNowAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const input = z.object({ fixtureId: idSchema }).safeParse(Object.fromEntries(formData));
  if (!input.success) return failure("Requête invalide.");

  const supabase = await createClient();
  const { count } = await supabase.from("predictions").select("id", { count: "exact", head: true }).eq("fixture_id", input.data.fixtureId);
  if ((count ?? 0) > 0) return failure("Ce match a déjà des pronostics : utilisez « Régénérer ».");

  let message: string | null = null;
  let ok = false;
  const summary = await runJob(
    "admin-generate-now",
    async (ctx) => {
      await buildMatchContext(ctx.db, ctx.api, input.data.fixtureId);
      const result = await generateForFixture(ctx.db, input.data.fixtureId, { mode: "initial", changedBy: admin.id });
      ok = result.ok;
      message = result.ok ? `${result.saved} pronostics générés.` : [result.error, ...result.errors].join(" ; ");
      if (result.ok) ctx.processed(1);
      else ctx.error(message);
    },
    { timeBudgetMs: 120_000 },
  );
  await logAdminAction(supabase, {
    action: "generate_predictions",
    entity: "fixtures",
    entityId: input.data.fixtureId,
    after: { status: summary.status, api_calls: summary.apiCalls, message },
  });
  fixturePaths(input.data.fixtureId);
  return ok ? success(message ?? "Pronostics générés.") : failure(message ?? summary.errors.join(" ; ") ?? "Génération impossible.");
}

export async function settleNowAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const input = z.object({ fixtureId: idSchema }).safeParse(Object.fromEntries(formData));
  if (!input.success) return failure("Requête invalide.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_settle_fixture", { p_fixture_id: input.data.fixtureId });
  if (error) return failure(error.message);
  if (!isOk(data)) {
    const code = (data as { code?: string } | null)?.code;
    return code === "NOT_FINISHED" ? failure("Le match n'est pas terminé (FT, AET ou PEN avec score).") : sqlFailure(data);
  }
  fixturePaths(input.data.fixtureId);
  return success(`${(data as { settled?: number }).settled ?? 0} pronostic(s) résolu(s).`);
}

export async function refundFixtureAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const input = z
    .object({ fixtureId: idSchema, reason: reasonSchema, confirm: z.literal("REMBOURSER", { error: "Tapez REMBOURSER pour confirmer." }) })
    .safeParse(Object.fromEntries(formData));
  if (!input.success) return failure(input.error.issues[0]?.message ?? "Requête invalide.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_refund_fixture", { p_fixture_id: input.data.fixtureId, p_reason: input.data.reason });
  if (error) return failure(error.message);
  if (!isOk(data)) return sqlFailure(data);
  const result = data as { refunded_unlocks: number; refunded_credits: number; voided: number };
  fixturePaths(input.data.fixtureId);
  return success(`${result.refunded_unlocks} déblocage(s) remboursé(s) (${result.refunded_credits} crédits), ${result.voided} pronostic(s) annulé(s).`);
}
