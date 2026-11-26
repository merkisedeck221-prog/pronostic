"use server";

import { redirect } from "next/navigation";
import { promoteIfAdminEmail } from "@/lib/auth/admin-promotion";
import { authErrorMessage, GENERIC_ERROR } from "@/lib/auth/errors";
import { getRequestOrigin } from "@/lib/auth/origin";
import { safeNextPath } from "@/lib/auth/redirect";
import {
  forgotPasswordSchema,
  newPasswordSchema,
  profileSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/auth/schemas";
import { BannedAccountError, requireUser } from "@/lib/auth/session";
import { formDataToObject, safeValues, validateForm, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

/**
 * Server Actions d'authentification et de profil.
 * Chaque action revalide les données avec Zod : la validation du navigateur
 * n'est qu'un confort, elle ne fait jamais foi.
 */

function errorState(message: string, values?: Record<string, string>): FormState {
  return { status: "error", message, values: values ? safeValues(values) : undefined };
}

// ----------------------------------------------------------------------------
// Inscription
// ----------------------------------------------------------------------------
export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formDataToObject(formData);
  const parsed = validateForm(signUpSchema, values);
  if (!parsed.ok) return parsed.state;
  const input = parsed.data;

  const supabase = await createClient();
  const origin = await getRequestOrigin();

  const { error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/tableau-de-bord")}`,
      // Lues par le déclencheur SQL handle_new_user (profil).
      data: {
        display_name: input.displayName,
        country: input.country,
        phone: input.phone ?? null,
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString(),
      },
    },
  });

  if (error) {
    console.error("[auth] signUp :", error.code, error.message);
    return errorState(authErrorMessage(error), values);
  }

  // Réponse identique que l'adresse existe déjà ou non (pas d'énumération des comptes).
  return { status: "success", values: { email: input.email } };
}

// ----------------------------------------------------------------------------
// Connexion
// ----------------------------------------------------------------------------
export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formDataToObject(formData);
  const parsed = validateForm(signInSchema, values);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    if (error && error.code !== "invalid_credentials") console.error("[auth] signIn :", error.code, error.message);
    return errorState(authErrorMessage(error), values);
  }

  await promoteIfAdminEmail(data.user.id, data.user.email);

  redirect(safeNextPath(values.next));
}

// ----------------------------------------------------------------------------
// Mot de passe oublié
// ----------------------------------------------------------------------------
export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formDataToObject(formData);
  const parsed = validateForm(forgotPasswordSchema, values);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const origin = await getRequestOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/reinitialiser-mot-de-passe")}`,
  });

  // Seule la limite d'envoi est signalée ; sinon même réponse, que le compte existe ou non.
  if (error && (error.code === "over_email_send_rate_limit" || error.status === 429)) {
    return errorState(authErrorMessage(error), values);
  }
  if (error) console.error("[auth] resetPasswordForEmail :", error.code, error.message);

  return { status: "success", values: { email: parsed.data.email } };
}

// ----------------------------------------------------------------------------
// Nouveau mot de passe (après le lien de réinitialisation)
// ----------------------------------------------------------------------------
export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = validateForm(newPasswordSchema, formDataToObject(formData));
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return errorState("Ce lien a expiré ou a déjà été utilisé. Demandez un nouveau lien de réinitialisation.");
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return errorState(authErrorMessage(error));

  redirect("/tableau-de-bord");
}

// ----------------------------------------------------------------------------
// Profil
// ----------------------------------------------------------------------------
export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formDataToObject(formData);
  const parsed = validateForm(profileSchema, values);
  if (!parsed.ok) return parsed.state;

  try {
    const user = await requireUser();
    const supabase = await createClient();
    // Seules ces colonnes sont envoyées ; role / is_banned sont de toute façon protégés en base.
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: parsed.data.displayName,
        country: parsed.data.country,
        phone: parsed.data.phone ?? null,
        timezone: parsed.data.timezone,
      })
      .eq("id", user.id);
    if (error) {
      console.error("[profil] Mise à jour impossible :", error.message);
      return errorState(GENERIC_ERROR, values);
    }
  } catch (error) {
    if (error instanceof BannedAccountError) return errorState(error.message, values);
    throw error;
  }

  return { status: "success", message: "Profil enregistré.", values: safeValues(values) };
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = validateForm(newPasswordSchema, formDataToObject(formData));
  if (!parsed.ok) return parsed.state;

  try {
    await requireUser();
  } catch (error) {
    if (error instanceof BannedAccountError) return errorState(error.message);
    throw error;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return errorState(authErrorMessage(error));

  return { status: "success", message: "Mot de passe modifié." };
}

// ----------------------------------------------------------------------------
// Déconnexion
// ----------------------------------------------------------------------------
export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/** Déconnexion de TOUS les appareils (révoque toutes les sessions du compte). */
export async function signOutEverywhereAction(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) console.error("[auth] signOut global :", error.code, error.message);
  redirect("/connexion?info=deconnexion-globale");
}
