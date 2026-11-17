# lib/payments

Couche « fournisseur de paiement » interchangeable (RG-F6-2) :

- interface `PaymentProvider` avec au minimum `createCheckout()` et `handleWebhook()` ;
- fournisseur `mock` (paiement simulé) pour le MVP ;
- plus tard : FedaPay ou KkiaPay, sans toucher au reste du code.

Le fournisseur actif est choisi par `PAYMENT_PROVIDER`. Les crédits ne sont ajoutés que par la fonction SQL `apply_topup`, une seule fois par référence de paiement.
