import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signature HMAC-SHA256 des notifications du fournisseur simulé.
 * Fonctions PURES (secret passé en paramètre), testées unitairement.
 *
 *   x-mock-timestamp : secondes Unix
 *   x-mock-signature : sha256=<hex HMAC(secret, `${timestamp}.${corps}`)>
 */

export const MOCK_SIGNATURE_HEADER = "x-mock-signature";
export const MOCK_TIMESTAMP_HEADER = "x-mock-timestamp";
/** Tolérance d'horloge et fenêtre anti-rejeu. */
export const MOCK_SIGNATURE_TOLERANCE_SECONDS = 300;

/** Secret du mock : PAYMENT_MOCK_SECRET, sinon dérivé de CRON_SECRET (jamais CRON_SECRET lui-même). */
export function deriveMockSecret(options: { paymentMockSecret?: string; cronSecret?: string }): string {
  if (options.paymentMockSecret && options.paymentMockSecret.length >= 32) return options.paymentMockSecret;
  if (options.cronSecret && options.cronSecret.length >= 32) {
    return createHmac("sha256", options.cronSecret).update("payment-mock-webhook-v1").digest("hex");
  }
  throw new Error("Secret du paiement simulé indisponible : définir PAYMENT_MOCK_SECRET ou CRON_SECRET (32 caractères min.).");
}

export function signMockPayload(secret: string, timestamp: number, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

export type SignatureCheck = { ok: true } | { ok: false; reason: "missing" | "malformed" | "expired" | "invalid" };

export function verifyMockSignature(
  secret: string,
  headers: { signature: string | null; timestamp: string | null },
  body: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): SignatureCheck {
  if (!headers.signature || !headers.timestamp) return { ok: false, reason: "missing" };
  if (!/^\d{1,12}$/.test(headers.timestamp) || !/^sha256=[0-9a-f]{64}$/.test(headers.signature)) {
    return { ok: false, reason: "malformed" };
  }
  const timestamp = Number(headers.timestamp);
  if (Math.abs(nowSeconds - timestamp) > MOCK_SIGNATURE_TOLERANCE_SECONDS) return { ok: false, reason: "expired" };

  const expected = Buffer.from(signMockPayload(secret, timestamp, body));
  const received = Buffer.from(headers.signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return { ok: false, reason: "invalid" };
  return { ok: true };
}
