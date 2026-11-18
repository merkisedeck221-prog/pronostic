"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { failure, isOk, sqlFailure, success, type AdminActionState } from "../result";

const userIdSchema = z.uuid();
const reasonSchema = z.string().trim().min(3, "Un motif est obligatoire (3 caractères minimum).").max(500);

function userPaths(userId: string) {
  revalidatePath("/admin/utilisateurs");
  revalidatePath(`/admin/utilisateurs/${userId}`);
}

/** Ajustement de solde : admin_adjust_balance (motif obligatoire, jamais négatif, journalisé en SQL). */
export async function adjustBalanceAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const input = z
    .object({
      userId: userIdSchema,
      amount: z.coerce.number().int().refine((n) => n !== 0 && Math.abs(n) <= 100_000, "Montant entier non nul (±100 000 max)."),
      reason: reasonSchema,
    })
    .safeParse(Object.fromEntries(formData));
  if (!input.success) return failure(input.error.issues[0]?.message ?? "Requête invalide.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_adjust_balance", {
    p_user_id: input.data.userId,
    p_amount: input.data.amount,
    p_reason: input.data.reason,
  });
  if (error) return failure(error.message);
  if (!isOk(data)) return sqlFailure(data);
  userPaths(input.data.userId);
  return success(`Solde ajusté : nouveau solde ${(data as { new_balance: number }).new_balance} crédits.`);
}

export async function setUserBannedAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const input = z
    .object({ userId: userIdSchema, banned: z.enum(["true", "false"]), reason: reasonSchema })
    .safeParse(Object.fromEntries(formData));
  if (!input.success) return failure(input.error.issues[0]?.message ?? "Requête invalide.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_user_banned", {
    p_user_id: input.data.userId,
    p_banned: input.data.banned === "true",
    p_reason: input.data.reason,
  });
  if (error) return failure(error.message);
  if (!isOk(data)) return sqlFailure(data);
  userPaths(input.data.userId);
  return success(input.data.banned === "true" ? "Compte suspendu." : "Compte réactivé.");
}

/** Rôle : double confirmation pour une promotion (boîte de dialogue + saisie de PROMOUVOIR). */
export async function setUserRoleAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const input = z
    .object({ userId: userIdSchema, role: z.enum(["user", "admin"]), reason: reasonSchema, confirm: z.string().optional() })
    .safeParse(Object.fromEntries(formData));
  if (!input.success) return failure(input.error.issues[0]?.message ?? "Requête invalide.");
  if (input.data.role === "admin" && input.data.confirm !== "PROMOUVOIR") {
    return failure("Tapez PROMOUVOIR pour confirmer la promotion.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_user_role", {
    p_user_id: input.data.userId,
    p_role: input.data.role,
    p_reason: input.data.reason,
  });
  if (error) return failure(error.message);
  if (!isOk(data)) return sqlFailure(data);
  userPaths(input.data.userId);
  return success(input.data.role === "admin" ? "Utilisateur promu administrateur." : "Rôle administrateur retiré.");
}
