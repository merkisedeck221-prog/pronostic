/**
 * Couche de paiement (RG-F6-2) : le reste de l'application ne connaît que
 * cette interface. Brancher FedaPay ou KkiaPay = ajouter une implémentation
 * (voir README.md), sans toucher aux pages ni aux fonctions SQL.
 */

export const PAYMENT_PROVIDER_NAMES = ["mock", "fedapay", "kkiapay"] as const;
export type PaymentProviderName = (typeof PAYMENT_PROVIDER_NAMES)[number];

/** Statut final d'un paiement, tel que transmis à apply_topup(). */
export type FinalPaymentStatus = "succeeded" | "failed" | "cancelled";
export type PaymentStatus = FinalPaymentStatus | "pending";

export type CheckoutUser = {
  id: string;
  email: string | null;
  displayName: string;
  phone: string | null;
};

export type CreateCheckoutInput = {
  /** Identifiant de la ligne topups (pending). */
  topupId: string;
  /** Montant LU EN BASE (credit_packs), jamais reçu du navigateur. */
  amountXof: number;
  user: CheckoutUser;
  /** Chemin interne vers lequel revenir après le paiement (page de résultat). */
  returnUrl: string;
  /** Libellé affiché par le fournisseur (« Pack Basic : 25 crédits »). */
  description: string;
};

export type CreateCheckoutResult = {
  /** URL (interne ou externe) de la page de paiement. */
  redirectUrl: string;
  /** Référence unique du paiement chez le fournisseur (topups.provider_ref). */
  providerRef: string;
};

export type WebhookResult = {
  providerRef: string;
  status: FinalPaymentStatus;
};

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  /** true = paiement de test (bandeau « Paiement de test »). */
  readonly isTest: boolean;
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  /**
   * Vérifie l'authenticité de la notification (signature) puis renvoie la
   * référence et le statut. Lève WebhookVerificationError si elle est invalide.
   */
  handleWebhook(request: Request): Promise<WebhookResult>;
  /** Facultatif : vérification active du statut auprès du fournisseur. */
  getStatus?(providerRef: string): Promise<PaymentStatus>;
}

/** Notification non authentique ou mal formée : répondre 401/400, ne rien créditer. */
export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookVerificationError";
  }
}

/** Fournisseur inconnu, non implémenté ou refusé dans cet environnement. */
export class PaymentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentConfigError";
  }
}
