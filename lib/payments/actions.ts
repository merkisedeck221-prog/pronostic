"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/redirect";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getPaymentProvider, isMockPaymentAllowed, PaymentConfigError } from "./index";
import { buildSignedMockWebhook } from "./mock";
import { createTopupResultSchema, mockOutcomeSchema, startTopupSchema, topupErrorMessage, topupIdSchema } from "./schemas";
import { processPaymentWebhook } from "./webhook";

export type StartTopupState = { error?: string } | null;

function resultUrl(topupId: string, next: string): string {
  return `/recharger/resultat?topup=${topupId}&next=${encodeURIComponent(next)}`;
}

/**
 * Choix d'un pack : crée la recharge « pending » (start_topup, session de
 * l'utilisateur : montants lus EN BASE), ouvre le paiement chez le fournisseur
 * et redirige. Seuls `packId`, `promoCode` (texte) et `next` sont lus dans le formulaire.
 */
export async function startTopupAction(_prev: StartTopupState, formData: FormData): Promise<StartTopupState> {
  const user = await requireUser({ allowBanned: true });
  if (user.profile.is_banned) return { error: topupErrorMessage("BANNED") };

  const input = startTopupSchema.safeParse({
    packId: formData.get("packId"),
    promoCode: formData.get("promoCode") ?? undefined,
  });
  if (!input.success) return { error: input.error.issues[0]?.path[0] === "promoCode" ? topupErrorMessage("PROMO_INVALID") : "Pack invalide." };
  const next = safeNextPath(formData.get("next"), "/portefeuille");

  let provider;
  try {
    provider = getPaymentProvider();
  } catch (error) {
    if (error instanceof PaymentConfigError) return { error: "Le paiement est momentanément indisponible." };
    throw error;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_topup", {
    p_pack_id: input.data.packId,
    p_provider: provider.name,
    p_promo_code: input.data.promoCode,
  });
  const created = createTopupResultSchema.safeParse(data);
  if (error || !created.success) {
    console.error("[payments] start_topup :", error?.message ?? "réponse invalide");
    return { error: topupErrorMessage(undefined) };
  }
  if (!created.data.ok) return { error: topupErrorMessage(created.data.code) };
  const topup = created.data;

  const checkout = await provider.createCheckout({
    topupId: topup.topup_id,
    amountXof: topup.amount_xof,
    user: { id: user.id, email: user.email || null, displayName: user.profile.display_name, phone: user.profile.phone },
    returnUrl: resultUrl(topup.topup_id, next),
    description: `Pack ${topup.pack_name} : ${topup.credits} crédits${topup.bonus_credits > 0 ? ` + ${topup.bonus_credits} bonus` : ""}${topup.promo_bonus_credits > 0 ? ` + ${topup.promo_bonus_credits} code promo` : ""}`,
  });

  // Référence du fournisseur : écriture serveur (topups n'est pas modifiable par l'utilisateur).
  const { error: refError } = await createAdminClient()
    .from("topups")
    .update({ provider_ref: checkout.providerRef })
    .eq("id", topup.topup_id)
    .eq("user_id", user.id)
    .is("provider_ref", null);
  if (refError) {
    console.error("[payments] provider_ref :", refError.message);
    return { error: topupErrorMessage(undefined) };
  }

  redirect(checkout.redirectUrl);
}

/**
 * Boutons de la page de paiement simulé. La signature HMAC est calculée ICI
 * (serveur) et la notification passe par le même traitement que la route
 * /api/payments/webhook/mock (appel interne, sans aller-retour réseau).
 */
export async function simulateMockPaymentAction(topupId: string, outcome: string, returnUrl: string): Promise<void> {
  const user = await requireUser();
  const id = topupIdSchema.safeParse(topupId);
  const status = mockOutcomeSchema.safeParse(outcome);
  const back = safeNextPath(returnUrl, "/portefeuille");
  if (!id.success || !status.success || !isMockPaymentAllowed()) redirect("/recharger");

  // La recharge doit appartenir à l'utilisateur (RLS) et utiliser le mock.
  const supabase = await createClient();
  const { data: topup } = await supabase
    .from("topups")
    .select("id, provider, provider_ref, status")
    .eq("id", id.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!topup || topup.provider !== "mock" || !topup.provider_ref) redirect("/recharger");

  if (topup.status === "pending") {
    const response = await processPaymentWebhook("mock", buildSignedMockWebhook(topup.provider_ref, status.data));
    if (!response.ok) console.error("[payments] paiement simulé :", response.status, await response.text());
  }
  redirect(back.startsWith("/recharger/resultat") ? back : resultUrl(topup.id, back));
}
