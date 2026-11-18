import "server-only";

import { z } from "zod";
import { getServerEnvKeys } from "@/lib/env";
import {
  deriveMockSecret,
  MOCK_SIGNATURE_HEADER,
  MOCK_TIMESTAMP_HEADER,
  signMockPayload,
  verifyMockSignature,
} from "./mock-signature";
import {
  WebhookVerificationError,
  type CreateCheckoutInput,
  type CreateCheckoutResult,
  type FinalPaymentStatus,
  type PaymentProvider,
  type WebhookResult,
} from "./types";

/**
 * Fournisseur SIMULÉ (MVP). La « page de paiement » est interne :
 * /recharger/paiement-simule/[topupId]. Ses boutons envoient une notification
 * signée (HMAC calculé côté serveur) au webhook /api/payments/webhook/mock.
 */

const mockWebhookBodySchema = z.object({
  providerRef: z.string().regex(/^mock_[0-9a-f-]{36}$/),
  status: z.enum(["succeeded", "failed", "cancelled"]),
});

function mockSecret(): string {
  const { PAYMENT_MOCK_SECRET } = getServerEnvKeys(["PAYMENT_MOCK_SECRET"]);
  if (PAYMENT_MOCK_SECRET) return deriveMockSecret({ paymentMockSecret: PAYMENT_MOCK_SECRET });
  // Repli : secret dérivé de CRON_SECRET (validé seulement dans ce cas).
  const { CRON_SECRET } = getServerEnvKeys(["CRON_SECRET"]);
  return deriveMockSecret({ cronSecret: CRON_SECRET });
}

export function mockProviderRef(topupId: string): string {
  return `mock_${topupId}`;
}

/** Notification signée, telle que l'enverrait un fournisseur (utilisée par la page de paiement simulé). */
export function buildSignedMockWebhook(
  providerRef: string,
  status: FinalPaymentStatus,
  url = "http://internal/api/payments/webhook/mock",
): Request {
  const body = JSON.stringify({ providerRef, status });
  const timestamp = Math.floor(Date.now() / 1000);
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [MOCK_TIMESTAMP_HEADER]: String(timestamp),
      [MOCK_SIGNATURE_HEADER]: signMockPayload(mockSecret(), timestamp, body),
    },
    body,
  });
}

export const mockProvider: PaymentProvider = {
  name: "mock",
  isTest: true,

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    return {
      providerRef: mockProviderRef(input.topupId),
      redirectUrl: `/recharger/paiement-simule/${input.topupId}?retour=${encodeURIComponent(input.returnUrl)}`,
    };
  },

  async handleWebhook(request: Request): Promise<WebhookResult> {
    const body = await request.text();
    const check = verifyMockSignature(
      mockSecret(),
      { signature: request.headers.get(MOCK_SIGNATURE_HEADER), timestamp: request.headers.get(MOCK_TIMESTAMP_HEADER) },
      body,
    );
    if (!check.ok) throw new WebhookVerificationError(`Signature ${check.reason}`);

    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new WebhookVerificationError("Corps JSON invalide");
    }
    const parsed = mockWebhookBodySchema.safeParse(json);
    if (!parsed.success) throw new WebhookVerificationError("Notification mal formée");
    return parsed.data;
  },
  // Pas de getStatus : le mock n'a pas d'état externe, le statut fait foi en base.
};
