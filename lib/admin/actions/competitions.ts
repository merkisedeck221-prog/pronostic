"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { leagueToCompetitionUpdate, slugify } from "@/lib/api-football/convert";
import { leagueItemSchema } from "@/lib/api-football/schemas";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { runSyncJob } from "@/lib/sync";
import { runJob } from "@/lib/sync/runner";
import { logAdminAction } from "../audit";
import { failure, success, type AdminActionState } from "../result";

const PATH = "/admin/competitions";
const idSchema = z.coerce.number().int().positive();

export async function toggleCompetitionAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const input = z.object({ id: idSchema, active: z.enum(["true", "false"]) }).safeParse(Object.fromEntries(formData));
  if (!input.success) return failure("Requête invalide.");
  const active = input.data.active === "true";

  const supabase = await createClient();
  const { data: before } = await supabase.from("competitions").select("is_active, name").eq("id", input.data.id).maybeSingle();
  if (!before) return failure("Compétition introuvable.");
  const { error } = await supabase.from("competitions").update({ is_active: active }).eq("id", input.data.id);
  if (error) return failure(error.message);
  await logAdminAction(supabase, {
    action: active ? "activate_competition" : "deactivate_competition",
    entity: "competitions",
    entityId: input.data.id,
    before: { is_active: before.is_active },
    after: { is_active: active },
  });
  revalidatePath(PATH);
  return success(`${before.name} ${active ? "activée" : "désactivée"}.`);
}

export async function setCompetitionOrderAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const input = z
    .object({ id: idSchema, sort_order: z.coerce.number().int().min(0).max(9999) })
    .safeParse(Object.fromEntries(formData));
  if (!input.success) return failure("Ordre invalide (0 à 9999).");

  const supabase = await createClient();
  const { data: before } = await supabase.from("competitions").select("sort_order").eq("id", input.data.id).maybeSingle();
  if (!before) return failure("Compétition introuvable.");
  const { error } = await supabase.from("competitions").update({ sort_order: input.data.sort_order }).eq("id", input.data.id);
  if (error) return failure(error.message);
  await logAdminAction(supabase, {
    action: "set_competition_order",
    entity: "competitions",
    entityId: input.data.id,
    before,
    after: { sort_order: input.data.sort_order },
  });
  revalidatePath(PATH);
  return success("Ordre enregistré.");
}

/** Saison courante (année de début, ex. 2026 pour 2026-2027) : normalement mise à jour par sync-competitions. */
export async function setCompetitionSeasonAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const input = z
    .object({ id: idSchema, current_season: z.coerce.number().int().min(1990).max(2100) })
    .safeParse(Object.fromEntries(formData));
  if (!input.success) return failure("Saison invalide (année entre 1990 et 2100).");

  const supabase = await createClient();
  const { data: before } = await supabase.from("competitions").select("current_season").eq("id", input.data.id).maybeSingle();
  if (!before) return failure("Compétition introuvable.");
  const { error } = await supabase.from("competitions").update({ current_season: input.data.current_season }).eq("id", input.data.id);
  if (error) return failure(error.message);
  await logAdminAction(supabase, {
    action: "set_competition_season",
    entity: "competitions",
    entityId: input.data.id,
    before,
    after: { current_season: input.data.current_season },
  });
  revalidatePath(PATH);
  return success("Saison enregistrée.");
}

/** Ajout par identifiant API-Football : vérification par /leagues (1 appel, budget compté), puis enregistrement. */
export async function addCompetitionAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const input = z
    .object({
      api_league_id: z.coerce.number().int().positive().max(1_000_000),
      category: z.enum(["club_league", "international"]),
      is_active: z.enum(["true", "false"]).default("false"),
    })
    .safeParse(Object.fromEntries(formData));
  if (!input.success) return failure("Identifiant ou catégorie invalide.");

  const supabase = await createClient();
  const { data: existing } = await supabase.from("competitions").select("id, name").eq("api_league_id", input.data.api_league_id).maybeSingle();
  if (existing) return failure(`Déjà enregistrée : ${existing.name}.`);

  let created: { id: number; name: string } | null = null;
  let problem: string | null = null;
  const summary = await runJob("admin-add-competition", async (ctx) => {
    const result = await ctx.api.get("/leagues", { id: input.data.api_league_id }, z.array(leagueItemSchema));
    const item = result.data[0];
    if (!item) {
      problem = "API-Football ne connaît pas cette compétition.";
      return;
    }
    const update = leagueToCompetitionUpdate(item);
    let slug = slugify(`${update.name}${update.country && input.data.category === "club_league" ? `-${update.country}` : ""}`) || `competition-${input.data.api_league_id}`;
    const { data: taken } = await ctx.db.from("competitions").select("id").eq("slug", slug).maybeSingle();
    if (taken) slug = `${slug}-${input.data.api_league_id}`;
    const { data, error } = await ctx.db
      .from("competitions")
      .insert({
        api_league_id: input.data.api_league_id,
        name: update.name,
        slug,
        category: input.data.category,
        type: update.type,
        country: update.country,
        logo_url: update.logo_url,
        current_season: update.current_season,
        coverage: update.coverage,
        is_active: input.data.is_active === "true",
        sort_order: 100,
      })
      .select("id, name")
      .single();
    if (error) {
      problem = error.message;
      return;
    }
    created = data;
    ctx.processed(1);
  });

  if (!created) return failure(problem ?? summary.errors.join(" ; ") ?? "Ajout impossible.");
  const saved = created as { id: number; name: string };
  await logAdminAction(supabase, {
    action: "add_competition",
    entity: "competitions",
    entityId: saved.id,
    after: { api_league_id: input.data.api_league_id, name: saved.name, category: input.data.category },
  });
  revalidatePath(PATH);
  return success(`${saved.name} ajoutée (${summary.apiCalls} appel API).`);
}

/** « Synchroniser maintenant » : matchs puis classements des compétitions actives. */
export async function syncCompetitionsNowAction(): Promise<AdminActionState> {
  await requireAdmin();
  const results = [];
  for (const job of ["sync-fixtures", "sync-standings"] as const) {
    const summary = await runSyncJob(job);
    results.push(`${job} : ${summary.status}, ${summary.itemsProcessed} éléments, ${summary.apiCalls} appels`);
  }
  const supabase = await createClient();
  await logAdminAction(supabase, { action: "run_sync_now", entity: "sync_runs", after: { results } });
  revalidatePath(PATH);
  return success(results.join(" · "));
}
