import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getProviderForWebhook } from "./index";
import { WebhookVerificationError } from "./types";

/**
 * Traitement d'une notification de paiement (route /api/payments/webhook/[provider]).
 * 1. le fournisseur vérifie l'authenticité (signature) ;
 * 2. la recharge est retrouvée par (provider, provider_ref) ;
 * 3. apply_topup() (clé secrète) applique le statut, une seule fois.
 * Un doublon déjà traité renvoie 200 (le fournisseur n'a pas à réessayer).
 */
export async function processPaymentWebhook(providerName: string, request: Request): Promise<Response> {
  const provider = getProviderForWebhook(providerName);
  if (!provider) return Response.json({ ok: false, error: "Fournisseur inconnu ou désactivé." }, { status: 404 });

  let notification;
  try {
    notification = await provider.handleWebhook(request);
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      return Response.json({ ok: false, error: "Notification non authentique." }, { status: 401 });
    }
    console.error("[payments] webhook :", (error as Error).message);
    return Response.json({ ok: false, error: "Erreur interne." }, { status: 500 });
  }

  let db;
  try {
    db = createAdminClient();
  } catch (error) {
    console.error("[payments] client serveur indisponible :", (error as Error).message);
    return Response.json({ ok: false, error: "Erreur interne." }, { status: 500 });
  }
  const { data: topup, error: lookupError } = await db
    .from("topups")
    .select("id")
    .eq("provider", provider.name)
    .eq("provider_ref", notification.providerRef)
    .maybeSingle();
  if (lookupError) {
    console.error("[payments] recherche de la recharge :", lookupError.message);
    return Response.json({ ok: false, error: "Erreur interne." }, { status: 500 });
  }
  if (!topup) return Response.json({ ok: false, error: "Recharge inconnue." }, { status: 404 });

  const { data, error } = await db.rpc("apply_topup", { p_topup_id: topup.id, p_status: notification.status });
  if (error) {
    console.error("[payments] apply_topup :", error.message);
    return Response.json({ ok: false, error: "Erreur interne." }, { status: 500 });
  }
  const result = data as { ok?: boolean; status?: string; already_processed?: boolean } | null;
  if (!result?.ok) return Response.json({ ok: false, error: "Recharge non applicable." }, { status: 422 });
  return Response.json({ ok: true, status: result.status, alreadyProcessed: result.already_processed === true });
}
