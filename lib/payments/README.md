# lib/payments — couche de paiement

Le reste de l'application ne connaît que l'interface `PaymentProvider` (`types.ts`, RG-F6-2).
Le fournisseur des **nouvelles** recharges est choisi par `PAYMENT_PROVIDER` (`index.ts`).

| Fichier | Rôle |
|---|---|
| `types.ts` | Interface `PaymentProvider` (`createCheckout`, `handleWebhook`, `getStatus` facultatif), erreurs |
| `registry.ts` | Règles pures : fournisseur autorisé ? (mock refusé en production si un vrai fournisseur est configuré, RG-F6-3) |
| `index.ts` | Registre : `getPaymentProvider()`, `getProviderForWebhook(name)`, `isMockPaymentAllowed()` |
| `mock.ts`, `mock-signature.ts` | Fournisseur simulé : page interne `/recharger/paiement-simule/[topupId]`, notifications signées HMAC-SHA256 |
| `webhook.ts` | Traitement commun des notifications : vérification par le fournisseur → recharge retrouvée par (`provider`, `provider_ref`) → `apply_topup()` (clé secrète) |
| `actions.ts` | Server Actions : `startTopupAction` (choix d'un pack), `simulateMockPaymentAction` (boutons du mock) |
| `queries.ts`, `schemas.ts` | Lectures (session utilisateur) et schémas Zod |

## Parcours

1. `/recharger` → `startTopupAction` : `create_topup(pack_id, provider)` (session ; montants lus **en base**), puis `provider.createCheckout()`, puis `topups.provider_ref` (écriture serveur), puis redirection vers `redirectUrl`.
2. Le fournisseur notifie `POST /api/payments/webhook/<provider>` → `processPaymentWebhook()` → `apply_topup(topup_id, status)` : crédit unique (idempotent), 200 même pour un doublon.
3. L'utilisateur revient sur `/recharger/resultat?topup=<id>&next=<page d'origine>` (rafraîchie toutes les 3 s pendant 30 s si en attente).

## Ajouter FedaPay ou KkiaPay (non implémentés)

1. **Variables d'environnement** (serveur uniquement, jamais `NEXT_PUBLIC_`), à ajouter dans `lib/env.ts` (schéma serveur), `.env.example` et Vercel :
   - FedaPay : `FEDAPAY_SECRET_KEY`, `FEDAPAY_WEBHOOK_SECRET`, `FEDAPAY_ENVIRONMENT` (`sandbox` | `live`) ;
   - KkiaPay : `KKIAPAY_PUBLIC_KEY`, `KKIAPAY_PRIVATE_KEY`, `KKIAPAY_SECRET`, `KKIAPAY_SANDBOX` (`true` | `false`).
2. **Créer** `lib/payments/fedapay.ts` (ou `kkiapay.ts`) avec `import "server-only"` et un objet `PaymentProvider` :
   - `name: "fedapay"`, `isTest` : vrai en sandbox (affiche le bandeau « Paiement de test ») ;
   - `createCheckout()` : créer la transaction chez le fournisseur (montant `amountXof`, devise XOF, description, client : e-mail / nom / téléphone, URL de retour **absolue** construite avec `NEXT_PUBLIC_APP_URL` + `returnUrl`), renvoyer `{ redirectUrl, providerRef }` (identifiant de transaction du fournisseur) ;
   - `handleWebhook(request)` : lire le corps **brut** (`request.text()`), vérifier la signature avec le secret de webhook du fournisseur (comparaison en temps constant), lever `WebhookVerificationError` sinon ; convertir le statut du fournisseur en `succeeded` / `failed` / `cancelled` ; idéalement, revérifier le statut par l'API (`getStatus`) avant de renvoyer `succeeded` ;
   - `getStatus(providerRef)` : appel à l'API de statut du fournisseur.
   - Valider toutes les réponses du fournisseur avec Zod.
3. **Enregistrer** le fournisseur dans `PROVIDERS` (`index.ts`). `PAYMENT_PROVIDER_NAMES` et la fonction SQL `create_topup` acceptent déjà `fedapay` et `kkiapay`.
4. **Configurer** chez le fournisseur l'URL de notification `https://<domaine>/api/payments/webhook/fedapay` (ou `/kkiapay`).
5. **Tests** : réponses enregistrées dans `tests/fixtures/payments/<fournisseur>/` (jamais l'API réelle en test unitaire) ; signature valide / invalide / absente ; correspondance des statuts.
6. Passer `PAYMENT_PROVIDER=fedapay` sur Vercel : le mock est alors refusé automatiquement en production (création de paiement et webhook `mock` → 404).

Points d'attention : les montants XOF sont des entiers ; la `provider_ref` est unique en base (idempotence) ; ne jamais créditer depuis l'URL de retour (seul le webhook vérifié crédite).
