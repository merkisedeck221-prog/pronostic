"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "../audit";
import { failure, success, type AdminActionState } from "../result";

const PATH = "/admin/packs";

const packSchema = z.object({
  id: z.coerce.number().int().positive().optional().or(z.literal("")),
  name: z.string().trim().min(2, "Nom trop court.").max(40),
  credits: z.coerce.number().int().min(1, "Au moins 1 crédit.").max(100_000),
  bonus_credits: z.coerce.number().int().min(0).max(100_000),
  price_xof: z.coerce.number().int().min(1, "Prix en XOF positif.").max(10_000_000),
  sort_order: z.coerce.number().int().min(0).max(9999).default(0),
});

export async function savePackAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const input = packSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) return failure(input.error.issues[0]?.message ?? "Pack invalide.");
  const { id, ...values } = input.data;
  const supabase = await createClient();

  if (id) {
    const { data: before } = await supabase.from("credit_packs").select("*").eq("id", id).maybeSingle();
    if (!before) return failure("Pack introuvable.");
    const { error } = await supabase.from("credit_packs").update(values).eq("id", id);
    if (error) return failure(error.message.includes("unique") ? "Ce nom est déjà utilisé." : error.message);
    await logAdminAction(supabase, { action: "update_pack", entity: "credit_packs", entityId: id, before, after: values });
    revalidatePath(PATH);
    return success("Pack modifié.");
  }

  const { data, error } = await supabase.from("credit_packs").insert({ ...values, is_active: false }).select("id").single();
  if (error) return failure(error.message.includes("unique") ? "Ce nom est déjà utilisé." : error.message);
  await logAdminAction(supabase, { action: "create_pack", entity: "credit_packs", entityId: data.id, after: values });
  revalidatePath(PATH);
  return success("Pack créé (inactif : activez-le pour le proposer).");
}

export async function setPackActiveAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const input = z.object({ id: z.coerce.number().int().positive(), active: z.enum(["true", "false"]) }).safeParse(Object.fromEntries(formData));
  if (!input.success) return failure("Requête invalide.");
  const active = input.data.active === "true";
  const supabase = await createClient();
  const { error } = await supabase.from("credit_packs").update({ is_active: active }).eq("id", input.data.id);
  if (error) return failure(error.message);
  await logAdminAction(supabase, { action: active ? "activate_pack" : "deactivate_pack", entity: "credit_packs", entityId: input.data.id, after: { is_active: active } });
  revalidatePath(PATH);
  return success(active ? "Pack activé." : "Pack désactivé.");
}

/** Suppression : uniquement si le pack n'a jamais été acheté ; sinon, il se désactive. */
export async function deletePackAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const input = z.object({ id: z.coerce.number().int().positive() }).safeParse(Object.fromEntries(formData));
  if (!input.success) return failure("Requête invalide.");
  const supabase = await createClient();
  const { count } = await supabase.from("topups").select("id", { count: "exact", head: true }).eq("pack_id", input.data.id);
  if ((count ?? 0) > 0) return failure("Ce pack a déjà été acheté : il ne peut pas être supprimé, désactivez-le.");
  const { data: before } = await supabase.from("credit_packs").select("*").eq("id", input.data.id).maybeSingle();
  if (!before) return failure("Pack introuvable.");
  const { error } = await supabase.from("credit_packs").delete().eq("id", input.data.id);
  if (error) return failure(error.message);
  await logAdminAction(supabase, { action: "delete_pack", entity: "credit_packs", entityId: input.data.id, before });
  revalidatePath(PATH);
  return success("Pack supprimé.");
}
