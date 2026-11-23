# Système de crédits v2 — diagnostic et plan d'intégration

**Date** : 23 novembre 2026 · **Statut** : plan validé le 23/11/2026 (décisions ci-dessous). Démarrage par le lot 0.

**Décisions du porteur (23/11/2026)** : D1 génération **à la demande, mutualisée** · D2 **lot A d'abord** (corners, cartons, combinés ensuite) · D3 **offres de packs datées**, crédits sans expiration · D5 **création d'un projet Supabase de développement**. D4 (prestataire de paiement réel) : en attente du compte et des clés.

Demande du porteur : 8 modules (portefeuille, packs, génération à la demande, 12 types d'analyses, historique, administration, sécurité, qualité), sans repartir de zéro ni supprimer d'existant.

---

## 1. Diagnostic : ce qui existe déjà

Le MVP (phases 1 à 12) contient déjà une grande partie des modules demandés. Le principe actuel du cahier des charges est : **l'IA analyse chaque match une seule fois, automatiquement, 48 h avant le coup d'envoi ; l'utilisateur paie pour débloquer (voir) le résultat**.

| Module demandé | Déjà en place | Manque |
|---|---|---|
| **1. Portefeuille** | Solde dans l'en-tête et `/portefeuille` ; achat par pack (`/recharger`, paiement simulé) ; liste des transactions (date, type, montant, solde après) ; types `topup`, `unlock`, `bonus`, `refund`, `admin_adjustment` | Filtres « consommés / reçus / remboursements » ; **notifications** ; **reçus de paiement** |
| **2. Packs** | Table `credit_packs` (prix XOF, crédits, bonus, actif, ordre) ; page `/admin/packs` | Les 5 packs nommés (Starter → VIP) ; **durée de validité** |
| **3. Génération** | Génération automatique par tâche planifiée ; déblocage atomique `unlock_prediction()` : prix calculé en SQL, `FOR UPDATE`, solde ≥ 0, double paiement impossible (contrainte unique), confirmation à l'écran | Génération **à la demande** ; **réservation** de crédits puis débit après succès ; anti-répétition par clé d'idempotence |
| **4. Types d'analyses** | 4 marchés : 1N2, score exact, plus/moins 2,5, BTTS, plus le « match complet » ; prix par marché et par compétition (`pricing_rules`) | 8 nouveaux types (double chance, mi-temps, corners, cartons, handicap, combinés…) ; prompt IA v2 ; règles de résolution |
| **5. Historique** | `/mes-pronostics` (match, marché, crédits, sélection, probabilité, résultat) ; pronostic figé après le premier achat (RG-F5-6) ; révisions historisées | Copie figée de ce que l'utilisateur a reçu ; statut détaillé de la génération |
| **6. Administration** | 13 pages : ajustement de solde avec motif et audit, remboursement d'un match, packs, tarifs, utilisateurs, transactions (+ export CSV), suivi IA, journal d'audit | Débit ou remboursement d'**une** transaction ; **promotions** ; **moyens de paiement** ; page **revenus** |
| **7. Sécurité** | Écritures uniquement par fonctions SQL `SECURITY DEFINER` ; aucune écriture possible depuis le navigateur ; recharge idempotente (`provider_ref` unique) ; seul un webhook signé crédite ; audit RLS rejoué en CI | Journal **réellement immuable** (aujourd'hui la clé serveur peut encore modifier ou supprimer une ligne de `credit_transactions`) ; vérification auprès d'un **vrai** prestataire (FedaPay/KkiaPay non branché) |
| **8. Qualité** | 216 tests unitaires ; tests d'intégration et Playwright écrits | Ils sont **désactivés** : il n'existe plus de base de développement, et la production ne doit pas servir aux tests |

---

## 2. Points de conflit avec le cahier des charges

La règle du projet (`CLAUDE.md`) impose de s'arrêter et de demander quand une consigne contredit le cahier des charges.

1. **Génération à la demande (module 3)**. Cahier des charges : génération automatique, *une fois par match*, réutilisée pour tous les acheteurs. Cette règle sert à maîtriser le coût de l'IA. La demande décrit au contraire une génération lancée par chaque utilisateur.
2. **Types d'analyses (module 4)**. Cahier des charges : 4 marchés. Passer à 12 change le prompt IA, la validation, la résolution automatique et la page Performances.
3. **Validité des crédits (module 2)**. Cahier des charges : « Les crédits n'expirent pas dans le MVP. »
4. **Paiement réel (modules 1 et 7)**. Cahier des charges : paiement simulé pendant le MVP, Mobile Money ensuite. La demande exige de vérifier chaque paiement auprès du prestataire, donc un vrai prestataire (comptes et clés FedaPay ou KkiaPay).

---

## 3. Contraintes techniques à connaître

- **Données des nouveaux marchés.**
  - Le score à la mi-temps est déjà en base (`ht_home`, `ht_away`) : mi-temps et mi-temps/fin de match sont faciles.
  - **Corners et cartons** : il faut appeler `/fixtures/statistics` après chaque match pour les résoudre (1 appel par match), et récupérer l'historique des équipes pour que l'IA ait de quoi les estimer. Avec le forfait Pro, c'est faisable mais plus cher en appels. La qualité de ces pronostics sera nettement plus faible que celle du 1N2.
  - Rien n'est possible tant que **le forfait API-Football Pro n'est pas activé** (aucun match en base).
- **Coût de l'IA.** Avec une génération par utilisateur, le coût OpenAI grandit avec le nombre d'acheteurs au lieu d'être fixe par match. Le prix en crédits devra le couvrir.
- **Expiration des crédits.** Elle oblige à suivre des « lots » de crédits (quel crédit expire quand, lequel est consommé en premier) : beaucoup de complexité comptable et de risques de litige.
- **Tests de l'argent.** Les tests des débits, remboursements et paiements doivent tourner sur une **base de développement séparée**. Il faut recréer un projet Supabase gratuit dédié aux tests.

---

## 4. Décisions demandées au porteur

| # | Question | Recommandation |
|---|---|---|
| D1 | Génération : par utilisateur, ou **à la demande mais mutualisée** (le premier qui paie déclenche l'IA, les suivants paient l'accès au même résultat) ? | **Mutualisée** : elle respecte l'esprit du cahier des charges (coût maîtrisé, un seul résultat par match, donc des performances publiques honnêtes) et apporte le parcours demandé (solde → coût → confirmation → réservation → IA → débit). |
| D2 | Quels nouveaux types en premier ? | **Lot A** : double chance, mi-temps, mi-temps/fin de match, handicap, autres lignes plus/moins (1,5 et 3,5). **Lot B, plus tard** : corners, cartons. « Résultat final » = 1N2 actuel (pas de doublon). « Combinés IA » : à préciser (combiné de plusieurs matchs ?). |
| D3 | Validité : expiration des **crédits** ou seulement des **offres de packs** (pack disponible du … au …) ? | **Offres de packs datées**, sans expiration des crédits. |
| D4 | Paiement réel : FedaPay ou KkiaPay, et à quel moment ? | Brancher le prestataire dès que vous avez le compte et les clés. Le reste se fait sans attendre. |
| D5 | Créer un projet Supabase de **développement** (gratuit) pour les tests ? | **Oui, indispensable** pour le module 8. |

---

## 5. Plan d'intégration proposé (par lots, chacun livré, testé et validé avant le suivant)

Chaque lot suit la procédure de fin de phase de `CLAUDE.md` : lint, types, tests, build, prévisualisation, mise à jour de `PROGRESS.md`, puis votre accord avant la fusion.

### Lot 0 — Socle de test (prérequis) — ✅ projet `pronostics-dev` (`mumyxqitlazkpjmcxfjm`) : 18 migrations sur 19 (`health_monitoring` en attente d'une confirmation du porteur), données de départ
- Projet Supabase de développement, migrations rejouées, tests d'intégration et Playwright réactivés en CI.

### Lot 1 — Sécurité du registre et portefeuille (modules 1 et 7) — ✅ fait sur la base de test (23/11), en attente de mise en production
- **Journal comptable immuable** : déclencheur interdisant `UPDATE` et `DELETE` sur `credit_transactions`, pour tous, y compris la clé serveur. Les corrections passent par une écriture inverse.
- `/portefeuille` : onglets Tout / Reçus / Consommés / Remboursements, et totaux par catégorie.
- **Reçus** : page `/portefeuille/recus/[id]` pour chaque recharge réussie (numéro, date, pack, crédits, bonus, montant XOF, prestataire, référence), imprimable ou enregistrable en PDF.
- **Notifications dans l'application** : table `notifications` (RLS : lecture de ses seules notifications), cloche dans l'en-tête. Déclencheurs : recharge réussie ou échouée, remboursement, ajustement admin, pronostic résolu. E-mails plus tard, une fois le SMTP en place.

### Lot 2 — Packs, promotions, administration (modules 2 et 6) — ✅ fait sur la base de test (24/11), en attente de mise en production
- Les 5 packs Starter, Basic, Premium, Pro et VIP (prix à fixer par vous), avec dates de disponibilité (décision D3).
- **Promotions** : codes promo (crédits offerts ou % de bonus, dates, nombre d'utilisations total et par personne), appliqués **côté serveur** dans `create_topup`, puis journalisés.
- **Admin** : débit ou remboursement d'une transaction précise (écriture inverse, motif, audit) ; page **Revenus** (par jour, mois, pack, prestataire ; crédits vendus, consommés, remboursés) ; page **Moyens de paiement** (activer ou désactiver un prestataire, libellés, ordre ; les clés restent dans les variables Vercel).

### Lot 3 — Génération à la demande avec réservation (module 3) — ✅ fait sur la base de test (24/11) ; appel réel à l'IA à vérifier avec le forfait API-Football Pro
Selon D1, en version mutualisée :
1. L'utilisateur choisit un match et un type d'analyse ; le serveur affiche le coût et son solde.
2. Confirmation, avec une **clé d'idempotence** générée côté serveur pour bloquer le double clic et les requêtes rejouées.
3. `reserve_generation()` (SQL, une transaction) : vérifie le solde, crée une **réservation** (`credit_holds`) qui bloque les crédits sans les débiter. Le solde disponible est le solde moins les réservations.
4. Moteur IA (pipeline existant). Si l'analyse existe déjà, pas d'appel à l'IA.
5. `capture_generation()` : enregistre le résultat, transforme la réservation en débit `unlock`, donne l'accès. En cas d'échec : `release_hold()`, rien n'est débité.
6. Tâche de sécurité : toute réservation de plus de 10 minutes est libérée automatiquement.
7. Limites anti-abus : une seule demande en cours par utilisateur et par match, et un plafond par minute.

La génération automatique 48 h avant le match peut rester en place pour les marchés principaux : réglage admin, activé ou non.

### Lot 4 — Nouveaux types d'analyses (module 4) — ✅ lot A fait sur la base de test (24/11) : 6 marchés, prompt v2, résolution TS + SQL (75 cas croisés)
- Table `markets` étendue, prix par type dans `pricing_rules` (déjà configurable).
- Prompt **v2** (`lib/ai/prompts/v2.ts`, jamais de modification silencieuse de v1), schéma Zod v2, règles de cohérence.
- Règles de résolution **en double**, TypeScript et SQL, avec cas de test croisés (règle du projet).
- Lot B (corners, cartons) : synchronisation `/fixtures/statistics` et dossier enrichi.

### Lot 5 — Historique et contrôles finaux (modules 5 et 8)
- Historique : copie figée de ce que l'utilisateur a reçu (sélection, probabilités, version du prompt), statut de génération, résultat réel.
- Admin : liste des générations par utilisateur et par match.
- Tests complets : calculs de prix, réservation et libération, double clic, rejeux, remboursements, paiements, permissions (attaques rejouées avec la clé publique), parcours Playwright.

---

## 6. Ordre et dépendances

```
Lot 0 (base de dev) ──► Lot 1 ──► Lot 2 ──► Lot 3 ──► Lot 4 ──► Lot 5
                                        ▲               ▲
             forfait API-Football Pro ──┴───────────────┘ (matchs réels nécessaires pour tester 3 et 4)
             compte FedaPay/KkiaPay ──► paiement réel (indépendant, branché dès réception des clés)
```

Les lots 1 et 2 peuvent démarrer **tout de suite** : ils ne dépendent ni d'API-Football ni de l'IA.
