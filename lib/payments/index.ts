import "server-only";

import { getServerEnvKeys } from "@/lib/env";
import { mockProvider } from "./mock";
import { assertProviderAllowed, isProductionDeployment, isProviderAllowed, type PaymentEnvironment } from "./registry";
import { PAYMENT_PROVIDER_NAMES, PaymentConfigError, type PaymentProvider, type PaymentProviderName } from "./types";

/**
 * Registre des fournisseurs de paiement : choisit l'implémentation selon
 * PAYMENT_PROVIDER. Ajouter un fournisseur : voir lib/payments/README.md.
 */

const PROVIDERS: Partial<Record<PaymentProviderName, PaymentProvider>> = {
  mock: mockProvider,
  // fedapay: fedapayProvider,  (à venir)
  // kkiapay: kkiapayProvider,  (à venir)
};

export function paymentEnvironment(): PaymentEnvironment {
  const { PAYMENT_PROVIDER } = getServerEnvKeys(["PAYMENT_PROVIDER"]);
  return { configured: PAYMENT_PROVIDER, production: isProductionDeployment() };
}

function implementation(name: PaymentProviderName): PaymentProvider {
  const provider = PROVIDERS[name];
  if (!provider) throw new PaymentConfigError(`Le fournisseur de paiement « ${name} » n'est pas encore implémenté.`);
  return provider;
}

/** Fournisseur utilisé pour les NOUVELLES recharges (PAYMENT_PROVIDER). */
export function getPaymentProvider(): PaymentProvider {
  const env = paymentEnvironment();
  assertProviderAllowed(env.configured, env);
  return implementation(env.configured);
}

/** Fournisseur désigné par l'URL d'un webhook ; null si inconnu ou refusé ici. */
export function getProviderForWebhook(name: string): PaymentProvider | null {
  if (!(PAYMENT_PROVIDER_NAMES as readonly string[]).includes(name)) return null;
  const providerName = name as PaymentProviderName;
  if (!isProviderAllowed(providerName, paymentEnvironment())) return null;
  return PROVIDERS[providerName] ?? null;
}

/** Le paiement simulé est-il utilisable ici ? (pages du mock) */
export function isMockPaymentAllowed(): boolean {
  return isProviderAllowed("mock", paymentEnvironment());
}

export { PaymentConfigError, WebhookVerificationError } from "./types";
export type { PaymentProvider, PaymentProviderName } from "./types";
