"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "../audit";
import { failure, success, type AdminActionState } from "../result";

const PATH = "/admin/tarifs";

export async function setPricingModeAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const input = z.object({ mode: z.enum(["per_market", "per_match", "both"]) }).safeParse(Object.fromEntries(formData));
  if (!input.success) return failure("Mode invalide.");
  const supabase = await createClient();
  const { data: before } = await supabase.from("app_settings").select("value").eq("key", "pricing_mode").maybeSingle();
  const { error } = await supabase.from("app_settings").upsert({ key: "pricing_mode", value: input.data.mode }, { onConflict: "key" });
  if (error) return failure(error.message);
  await logAdminAction(supabase, { action: "set_pricing_mode", entity: "app_settings", entityId: "pricing_mode", before, after: { value: input.data.mode } });
  revalidatePath(PATH);
  return success("Mode de tarification enregistré.");
}

const priceSchema = z
  .object({
    scope: z.enum(["market", "match_bundle"]),
    market_code: z.string().regex(/^[A-Z0-9_]{1,40}$/).optional().or(z.literal("")),
    competition_id: z.coerce.number().int().positive().optional().or(z.literal("")),
    credits: z.coerce.number().int().min(0).max(10_000),
    is_active: z.enum(["true", "false"]).default("true"),
  })
  .refine((v) => (v.scope === "market" ? Boolean(v.market_code) : !v.market_code), "Marché requis pour un prix de marché, interdit pour le match complet.");

/** Prix d'un marché ou du match complet, général ou propre à une compétition (création ou modification). */
export async function savePriceAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const raw: Record<string, FormDataEntryValue> = Object.fromEntries(formData);
  // Formulaire de surcharge : « target » = "match_bundle" ou "market:CODE".
  if (typeof raw.target === "string") {
    const [scope, code] = raw.target.split(":");
    raw.scope = scope === "market" ? "market" : "match_bundle";
    raw.market_code = scope === "market" ? (code ?? "") : "";
    delete raw.target;
  }
  const input = priceSchema.safeParse(raw);
  if (!input.success) return failure(input.error.issues[0]?.message ?? "Prix invalide (entier de 0 à 10 000).");
  const marketCode = input.data.market_code || null;
  const competitionId = input.data.competition_id === "" || input.data.competition_id === undefined ? null : input.data.competition_id;

  const supabase = await createClient();
  let query = supabase.from("pricing_rules").select("id, credits, is_active").eq("scope", input.data.scope);
  query = marketCode === null ? query.is("market_code", null) : query.eq("market_code", marketCode);
  query = competitionId === null ? query.is("competition_id", null) : query.eq("competition_id", competitionId);
  const { data: existing } = await query.maybeSingle();

  const values = { credits: input.data.credits, is_active: input.data.is_active === "true" };
  const { error } = existing
    ? await supabase.from("pricing_rules").update(values).eq("id", existing.id)
    : await supabase.from("pricing_rules").insert({ scope: input.data.scope, market_code: marketCode, competition_id: competitionId, ...values });
  if (error) return failure(error.message);
  await logAdminAction(supabase, {
    action: existing ? "update_price" : "create_price",
    entity: "pricing_rules",
    entityId: existing?.id ?? null,
    before: existing ? { credits: existing.credits, is_active: existing.is_active } : null,
    after: { scope: input.data.scope, market_code: marketCode, competition_id: competitionId, ...values },
  });
  revalidatePath(PATH);
  return success("Prix enregistré.");
}

/** Suppression d'une surcharge par compétition (les règles générales ne se suppriment pas). */
export async function deletePriceOverrideAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const input = z.object({ id: z.coerce.number().int().positive() }).safeParse(Object.fromEntries(formData));
  if (!input.success) return failure("Requête invalide.");
  const supabase = await createClient();
  const { data: rule } = await supabase.from("pricing_rules").select("*").eq("id", input.data.id).maybeSingle();
  if (!rule) return failure("Règle introuvable.");
  if (rule.competition_id === null) return failure("Une règle générale ne se supprime pas : modifiez son prix ou désactivez-la.");
  const { error } = await supabase.from("pricing_rules").delete().eq("id", input.data.id);
  if (error) return failure(error.message);
  await logAdminAction(supabase, { action: "delete_price_override", entity: "pricing_rules", entityId: rule.id, before: rule });
  revalidatePath(PATH);
  return success("Surcharge supprimée.");
}
