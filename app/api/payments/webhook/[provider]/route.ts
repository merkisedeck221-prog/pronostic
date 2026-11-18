import { processPaymentWebhook } from "@/lib/payments/webhook";

/**
 * Notifications des fournisseurs de paiement. Authenticité vérifiée par le
 * fournisseur (signature), puis apply_topup() avec la clé secrète.
 * Jamais mis en cache ; aucune session utilisateur requise.
 */
export async function POST(request: Request, { params }: RouteContext<"/api/payments/webhook/[provider]">) {
  const { provider } = await params;
  return processPaymentWebhook(provider, request);
}
