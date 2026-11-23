"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "../audit";
import { isValidPeriod, optionalLocalDateTime } from "../datetime";
import { failure, success, type AdminActionState } from "../result";

const PATH = "/admin/promotions";

const optionalInt = (min: number, max: number) =>
  z
    .union([z.literal(""), z.coerce.number().int().min(min).max(max)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v));

/**
 * Code promo de recharge. Le bonus est toujours calculé en base au moment de
 * la recharge (start_topup) : l'admin ne fixe que les règles.
 */
const promoSchema = z
  .object({
    id: z.union([z.literal(""), z.coerce.number().int().positive()]).optional(),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,30}$/, "Code : 3 à 30 caractères (lettres, chiffres, - ou _)."),
    description: z
      .string()
      .trim()
      .max(200, "Description trop longue.")
      .optional()
      .transform((v) => (v ? v : null)),
    kind: z.enum(["bonus_credits", "bonus_percent"], { message: "Type de bonus invalide." }),
    value: z.coerce.number().int().min(1, "Valeur d'au moins 1."),
    starts_at: optionalLocalDateTime,
    ends_at: optionalLocalDateTime,
    max_uses: optionalInt(1, 1_000_000),
    max_uses_per_user: z.coerce.number().int().min(1).max(1000).default(1),
    min_price_xof: z.coerce.number().int().min(0).max(10_000_000).default(0),
  })
  .refine((p) => p.kind !== "bonus_percent" || p.value <= 200, { message: "Pourcentage : 200 % au plus.", path: ["value"] })
  .refine((p) => p.kind !== "bonus_credits" || p.value <= 100_000, { message: "Bonus : 100 000 crédits au plus.", path: ["value"] })
  .refine((p) => isValidPeriod(p.starts_at, p.ends_at), { message: "La fin doit être après le début.", path: ["ends_at"] });

export async function savePromoAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const input = promoSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) return failure(input.error.issues[0]?.message ?? "Code promo invalide.");
  const { id, ...values } = input.data;
  const supabase = await createClient();

  if (id) {
    const { data: before } = await supabase.from("promo_codes").select("*").eq("id", id).maybeSingle();
    if (!before) return failure("Code promo introuvable.");
    const { error } = await supabase.from("promo_codes").update(values).eq("id", id);
    if (error) return failure(error.message.includes("unique") ? "Ce code existe déjà." : "Enregistrement impossible.");
    await logAdminAction(supabase, { action: "update_promo", entity: "promo_codes", entityId: id, before, after: values });
    revalidatePath(PATH);
    return success("Code promo modifié.");
  }

  const { data, error } = await supabase
    .from("promo_codes")
    .insert({ ...values, created_by: admin.id })
    .select("id")
    .single();
  if (error) return failure(error.message.includes("unique") ? "Ce code existe déjà." : "Création impossible.");
  await logAdminAction(supabase, { action: "create_promo", entity: "promo_codes", entityId: data.id, after: values });
  revalidatePath(PATH);
  return success(`Code ${values.code} créé.`);
}

export async function setPromoActiveAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const input = z
    .object({ id: z.coerce.number().int().positive(), active: z.enum(["true", "false"]) })
    .safeParse(Object.fromEntries(formData));
  if (!input.success) return failure("Requête invalide.");
  const active = input.data.active === "true";
  const supabase = await createClient();
  const { data: before } = await supabase.from("promo_codes").select("code, is_active").eq("id", input.data.id).maybeSingle();
  if (!before) return failure("Code promo introuvable.");
  const { error } = await supabase.from("promo_codes").update({ is_active: active }).eq("id", input.data.id);
  if (error) return failure("Modification impossible.");
  await logAdminAction(supabase, {
    action: active ? "activate_promo" : "deactivate_promo",
    entity: "promo_codes",
    entityId: input.data.id,
    before,
    after: { is_active: active },
  });
  revalidatePath(PATH);
  return success(active ? `Code ${before.code} activé.` : `Code ${before.code} désactivé.`);
}
