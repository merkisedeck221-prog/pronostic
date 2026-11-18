import { PaymentConfigError, type PaymentProviderName } from "./types";

/**
 * Règles PURES de choix du fournisseur (testées unitairement).
 * RG-F6-3 : en production, le mock est refusé dès qu'un vrai fournisseur est configuré.
 */

export type PaymentEnvironment = {
  configured: PaymentProviderName;
  /** Déploiement de production (VERCEL_ENV = production). */
  production: boolean;
};

export function isProductionDeployment(source: Record<string, string | undefined> = process.env): boolean {
  return source.VERCEL_ENV === "production";
}

/** Le fournisseur `name` peut-il être utilisé (création de paiement ou webhook) ? */
export function isProviderAllowed(name: PaymentProviderName, env: PaymentEnvironment): boolean {
  if (name === env.configured) return true;
  // Hors production, le mock reste disponible pour les tests même si un autre fournisseur est configuré.
  return name === "mock" && !env.production;
}

export function assertProviderAllowed(name: PaymentProviderName, env: PaymentEnvironment): void {
  if (!isProviderAllowed(name, env)) {
    throw new PaymentConfigError(
      name === "mock"
        ? "Le paiement simulé est désactivé en production lorsqu'un fournisseur réel est configuré."
        : `Le fournisseur ${name} n'est pas celui configuré (PAYMENT_PROVIDER=${env.configured}).`,
    );
  }
}
