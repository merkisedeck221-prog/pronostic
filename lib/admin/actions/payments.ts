"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { PAYMENT_PROVIDER_NAMES } from "@/lib/payments/types";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { logAdminAction } from "../audit";
import { failure, isOk, sqlFailure, success, type AdminActionState } from "../result";

const labelSchema = z.string().trim().min(2, "Libellé trop court.").max(60, "Libellé trop long (60 caractères).");

/**
 * Moyens de paiement : activation et libellé par fournisseur (app_settings
 * « payment_methods »). Un moyen désactivé est refusé par start_topup (SQL).
 * Les clés des fournisseurs restent dans les variables Vercel, jamais ici.
 */
export async function savePaymentMethodsAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const value: Record<string, { enabled: boolean; label: string }> = {};
  for (const name of PAYMENT_PROVIDER_NAMES) {
    const label = labelSchema.safeParse(formData.get(`label_${name}`));
    if (!label.success) return failure(`${name} : ${label.error.issues[0]?.message ?? "libellé invalide"}`);
    value[name] = { enabled: formData.get(`enabled_${name}`) === "on", label: label.data };
  }
  const supabase = await createClient();
  const { data: before } = await supabase.from("app_settings").select("value").eq("key", "payment_methods").maybeSingle();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "payment_methods", value: value as Json, is_public: true, description: "Moyens de paiement : activation et libellé affiché par fournisseur." });
  if (error) return failure("Enregistrement impossible.");
  await logAdminAction(supabase, { action: "update_payment_methods", entity: "app_settings", entityId: "payment_methods", before: before?.value, after: value });
  revalidatePath("/admin/paiements");
  revalidatePath("/recharger");
  return success("Moyens de paiement enregistrés.");
}

/** Annulation (écriture inverse) d'une transaction : fonction SQL admin, journalisée, une seule fois. */
export async function reverseTransactionAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const input = z
    .object({
      id: z.coerce.number().int().positive(),
      reason: z.string().trim().min(3, "Un motif est obligatoire (3 caractères au moins).").max(500),
    })
    .safeParse(Object.fromEntries(formData));
  if (!input.success) return failure(input.error.issues[0]?.message ?? "Requête invalide.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_reverse_transaction", {
    p_transaction_id: input.data.id,
    p_reason: input.data.reason,
  });
  if (error) return failure("Annulation impossible.");
  if (!isOk(data)) return sqlFailure(data, "Annulation refusée.");
  revalidatePath("/admin/transactions");
  return success(`Transaction annulée. Nouveau solde : ${(data as { new_balance?: number }).new_balance ?? "—"} crédits.`);
}
