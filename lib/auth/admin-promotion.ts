import "server-only";

import { getServerEnvKeys } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Promotion automatique des administrateurs listés dans ADMIN_EMAILS
 * (cahier des charges, section 3). Appelée côté serveur au retour du lien
 * d'e-mail (callback) et à chaque connexion.
 *
 * - N'agit que si le rôle actuel est « user » (jamais de rétrogradation).
 * - Utilise le client administrateur (clé secrète) : l'utilisateur ne peut pas
 *   déclencher lui-même cette écriture.
 * - Journalise l'action dans admin_audit_log (RG-F9-1).
 * - Ne bloque jamais la connexion : une erreur est seulement journalisée.
 */
export async function promoteIfAdminEmail(userId: string, email: string | null | undefined): Promise<boolean> {
  if (!email) return false;

  let adminEmails: string[];
  try {
    adminEmails = getServerEnvKeys(["ADMIN_EMAILS"]).ADMIN_EMAILS;
  } catch (error) {
    console.error("[auth] ADMIN_EMAILS invalide :", (error as Error).message);
    return false;
  }
  if (!adminEmails.includes(email.trim().toLowerCase())) return false;

  try {
    const admin = createAdminClient();

    const { data: profile, error: readError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();
    if (readError || !profile) throw new Error(readError?.message ?? "profil introuvable");
    if (profile.role !== "user") return false;

    // Condition sur le rôle dans l'UPDATE : deux connexions simultanées ne créent qu'une promotion.
    const { data: updated, error: updateError } = await admin
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", userId)
      .eq("role", "user")
      .select("id");
    if (updateError) throw new Error(updateError.message);
    if (!updated || updated.length === 0) return false;

    const { error: auditError } = await admin.from("admin_audit_log").insert({
      admin_id: null,
      action: "promote_admin",
      entity: "profiles",
      entity_id: userId,
      before: { role: "user" },
      after: { role: "admin" },
      reason: "Adresse e-mail présente dans ADMIN_EMAILS",
    });
    if (auditError) console.error("[auth] Journal d'audit non écrit :", auditError.message);

    return true;
  } catch (error) {
    console.error("[auth] Promotion admin impossible :", (error as Error).message);
    return false;
  }
}
