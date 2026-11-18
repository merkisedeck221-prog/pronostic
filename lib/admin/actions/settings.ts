"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { logAdminAction } from "../audit";
import { failure, success, type AdminActionState } from "../result";
import { parseSettingInput, settingDefinition } from "../settings";

const PATH = "/admin/parametres";

export async function saveSettingAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const key = z.string().regex(/^[a-z0-9_]{1,60}$/).safeParse(formData.get("key"));
  if (!key.success) return failure("Clé invalide.");
  const definition = settingDefinition(key.data);
  const raw = formData.get("value");
  const parsed = parseSettingInput(definition, typeof raw === "string" ? raw : definition.kind === "boolean" ? "false" : null);
  if (!parsed.ok) return failure(parsed.error);

  const supabase = await createClient();
  const { data: before } = await supabase.from("app_settings").select("value").eq("key", key.data).maybeSingle();
  if (!before) return failure("Paramètre introuvable.");
  const { error } = await supabase.from("app_settings").update({ value: parsed.value as Json }).eq("key", key.data);
  if (error) return failure(error.message);
  await logAdminAction(supabase, { action: "update_setting", entity: "app_settings", entityId: key.data, before, after: { value: parsed.value } });
  revalidatePath(PATH);
  return success(`${definition.label} enregistré.`);
}

export async function setMarketActiveAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const input = z
    .object({ code: z.string().regex(/^[A-Z0-9_]{1,40}$/), active: z.enum(["true", "false"]) })
    .safeParse(Object.fromEntries(formData));
  if (!input.success) return failure("Requête invalide.");
  const active = input.data.active === "true";
  const supabase = await createClient();
  const { error } = await supabase.from("markets").update({ is_active: active }).eq("code", input.data.code);
  if (error) return failure(error.message);
  await logAdminAction(supabase, { action: active ? "activate_market" : "deactivate_market", entity: "markets", entityId: input.data.code, after: { is_active: active } });
  revalidatePath(PATH);
  return success(active ? "Marché activé." : "Marché désactivé.");
}
