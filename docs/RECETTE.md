# Recette fonctionnelle — phase 11

Contrôle du cahier des charges règle par règle (toutes les RG-F*) puis page par page (section 4).

**Légende** : **Oui** = implémentée · **Partiel → corrigé** = incomplète, corrigée pendant cette phase · **Non (hors périmètre)** = explicitement exclue du MVP.

**Abréviations des tests**

| Abréviation | Fichiers |
|---|---|
| `sec` | `tests/security/*.test.ts` (RLS, accès admin, catalogue, audit) |
| `cred` | `tests/credits/` |
| `pay` | `tests/payments/` |
| `set` | `tests/settlement/` |
| `adm` | `tests/admin/` |
| `e2e` | `tests/e2e/` (Playwright) |
| `unit` | tests Vitest dans `lib/**` |
| `sql` | requête réelle documentée dans `docs/SECURITE.md` ou `docs/PROGRESS.md` |

Les tests `sec`, `cred`, `pay`, `set`, `adm` et `e2e` tournent en CI contre Supabase DEV, une fois les secrets `SUPABASE_DEV_*` ajoutés.

## 1. Règles de gestion

| Règle | Implémentée | Test qui la couvre | Remarque |
|---|---|---|---|
| RG-F1-1 CGU + 18 ans obligatoires, date enregistrée | Oui | unit `lib/auth/schemas.test.ts` ; sec `rls.test.ts` (handle_new_user) ; e2e (`terms_accepted_at` non nul) | date non modifiable via l'API (sql) |
| RG-F1-2 compte suspendu : plus de pages privées ni de déblocage | Oui | sec `admin-access.test.ts` ; sql (`BANNED` sur `unlock_prediction` / `create_topup`) | la mise en page affiche « Compte suspendu » |
| RG-F1-3 rôle admin attribué seulement par la base ou un admin | Oui | sec `rls.test.ts`, `audit.test.ts` ; adm (pas sur soi-même) ; unit `admin-promotion.test.ts` | |
| RG-F1-4 crédits de bienvenue une seule fois (`bonus`) | Oui | sql (index unique `credit_transactions_welcome_once_idx`) | valeur 0 par défaut |
| RG-F2-1 seuls les matchs publiés de compétitions actives | Oui | sec `catalog.test.ts` ; sql `is_fixture_visible` | |
| RG-F2-2 UTC stocké, affichage dans le fuseau (défaut Porto-Novo) | Oui | unit `lib/utils/dates.test.ts` | |
| RG-F2-3 statut clair d'un match reporté, annulé, interrompu | Oui | unit `lib/utils/match-status.test.ts` | message sur la fiche |
| RG-F2-4 fenêtre par défaut de 7 jours **(paramètre)** | Partiel → corrigé | unit `dates.test.ts` (fenêtre paramétrable) | la durée était codée en dur : nouveau paramètre `fixtures_window_days` (1 à 14), éditable dans `/admin/parametres` |
| RG-F3-1 la partie gratuite ne révèle ni sélection ni explication | Oui | sec `catalog.test.ts` ; cred (6a, 6b) ; e2e (score exact invisible avant déblocage) | `get_fixture_public_context` lit `match_contexts` par liste blanche |
| RG-F4-1 temps réglementaire (hors prolongations et tirs au but) | Oui | unit `lib/settle/rules.test.ts` (match AET) ; set (AET) ; test croisé TS ↔ SQL (37 cas) | |
| RG-F4-2 avant déblocage : nom, prix, cadenas | Oui | cred (6a, 6b) ; e2e | |
| RG-F4-3 pronostic masqué ni visible ni achetable | Oui | e2e admin (marché masqué absent de la fiche) ; sql | les acheteurs existants le conservent |
| RG-F4-4 après le match, pronostics publics (`reveal_after_match`) | Oui | sql (phase 9) ; set (performances) | paramètre à confirmer par le porteur (point ouvert du cahier) |
| RG-F5-1 déblocage atomique | Oui | cred (1, 3) ; sql | une seule fonction SQL, une transaction |
| RG-F5-2 solde jamais négatif, refus si insuffisant | Oui | cred (3) ; e2e (refus puis Recharger) ; `CHECK (balance >= 0)` | |
| RG-F5-3 pas de double paiement ; match complet réduit | Oui | cred (2 : 5 appels simultanés, 5 : prix réduit) ; e2e (match complet à prix réduit) | |
| RG-F5-4 déblocages fermés au coup d'envoi | Oui | cred (4) ; sec `audit.test.ts` | bouton retiré, message « Les déblocages sont fermés » |
| RG-F5-5 prix calculé côté serveur | Oui | unit `credits.test.ts` (aucun prix accepté) ; cred | |
| RG-F5-6 pronostic figé dès le premier achat (texte corrigeable, historisé) | Oui | sql (phases 6 et 10) ; adm | `is_locked`, régénération refusée, `prediction_revisions` |
| RG-F5-7 match annulé / reporté > 48 h : remboursement + `void` | Oui | set (annulé, reporté 24 h / 72 h) ; sql | désactivable (`refund_on_cancel`) |
| RG-F6-1 recharge `pending`, créditée une seule fois | Oui | pay (1, 2 : doublon et rafale, 3 : échec) | |
| RG-F6-2 interface `PaymentProvider` | Oui | unit `lib/payments/payments.test.ts` | ajouter FedaPay ou KkiaPay : `lib/payments/README.md` |
| RG-F6-3 mock désactivé en production si un vrai fournisseur est configuré | Oui | unit `payments.test.ts` (choix du fournisseur) | |
| RG-F6-4 solde après chaque transaction ; contrôle de cohérence admin | Oui | cred (`balance_after`) ; sql (`admin_consistency_check`) | `/admin/transactions` → « Contrôle de cohérence » |
| RG-F7-1 résolution seulement FT / AET / PEN avec score | Oui | unit `rules.test.ts` ; set (`NOT_FINISHED`) | |
| RG-F7-2 résolution idempotente | Oui | set (rejouée sans effet) | |
| RG-F8-1 taux sur tous les pronostics publiés, achetés ou non | Oui | set (jeu de données connu, pronostic masqué exclu) | |
| RG-F9-1 journal d'audit des actions sensibles | Oui | adm (ajustement journalisé) ; e2e admin (prix, ajustement, masquage) ; sql (10 actions) | page `/admin/journal` |
| RG-F9-2 ajustement : motif obligatoire, jamais négatif | Oui | adm ; sql | |
| RG-F9-3 synchronisations et générations IA lançables depuis l'admin | Oui | unit `actions.test.ts` (accès) ; à vérifier en conditions réelles | `/admin/synchronisation`, « Générer maintenant » |

## 2. Section 11 (sécurité, fiabilité, conformité)

| Exigence | Implémentée | Test | Remarque |
|---|---|---|---|
| Aucune lecture directe des pronostics avec la clé publique | Oui | sec, cred (7), `audit.test.ts` | |
| Aucune écriture directe sur les tables de crédits | Oui | sec, `audit.test.ts` | |
| `FOR UPDATE` sur le portefeuille, `CHECK`, unicités | Oui | cred (2) ; pay (2) | |
| Les 5 tests obligatoires (double déblocage, solde insuffisant, après coup d'envoi, recharge confirmée deux fois, remboursement) | Oui | cred (2, 3, 4) ; pay (2) ; set (remboursement) | |
| `server-only` sur les modules secrets | Oui | analyse du bundle (SECURITE.md § 6) | |
| `/api/cron/*` protégé | Oui | unit `cron-auth.test.ts` ; HTTP (SECURITE.md § 4) | |
| Signature du webhook | Oui | unit `payments.test.ts` ; pay ; HTTP | |
| Rôle admin vérifié côté serveur | Oui | unit `actions.test.ts` ; adm ; sec `admin-access.test.ts` ; HTTP (404) | |
| Tâches idempotentes, petits lots | Oui | unit `runner.test.ts` (deux exécutions) ; set ; pay | |
| Délai maximal et 2 nouvelles tentatives par appel externe ; une erreur n'arrête pas le lot | Oui | unit `client.test.ts`, `runner.test.ts`, `engine.test.ts` | |
| Erreurs de synchronisation et d'IA visibles dans l'admin ; matchs du jour sans pronostic | Oui | sql (`admin_overview`) | `/admin`, `/admin/synchronisation`, `/admin/ia` |
| Mentions en pied de page et sur chaque fiche match | Oui | revue du code | |
| CGU provisoires | Oui | revue du code | |
| Suppression du compte sur demande (traitement manuel) | Partiel → corrigé | — | les CGU le mentionnaient ; `/profil` l'indique maintenant |

## 3. Pages (section 4)

### Pages publiques

| Page | Implémentée | Test | Remarque |
|---|---|---|---|
| `/` accueil provisoire | Oui | HTTP | redirige l'utilisateur connecté vers `/tableau-de-bord` |
| `/inscription` | Oui | e2e ; unit `schemas.test.ts` | |
| `/connexion` | Oui | e2e | `next` sécurisé |
| `/mot-de-passe-oublie` | Oui | unit (schémas) | |
| `/reinitialiser-mot-de-passe` | Oui | unit (schémas) | |
| `/performances` | Oui | set ; HTTP (200 sans compte, message si indisponible) | avertissement sous 50 pronostics résolus |
| `/cgu` | Oui | revue | |
| `/jeu-responsable` | Oui | revue | |

### Pages de l'utilisateur connecté

| Page | Implémentée | Test | Remarque |
|---|---|---|---|
| `/tableau-de-bord` | Oui | e2e (connexion) | solde, Recharger, matchs < 48 h, derniers pronostics, Performances |
| `/competitions` | Oui | sec `catalog.test.ts` | |
| `/competitions/[slug]` | Oui | sec `catalog.test.ts` | |
| `/matchs` | Oui | e2e | fenêtre paramétrable (corrigé), filtre, pastille |
| `/matchs/[id]` | Oui | e2e ; cred | partie payante, résultat après le match |
| `/mes-pronostics` | Oui | e2e ; set | |
| `/portefeuille` | Oui | e2e | |
| `/recharger` | Oui | e2e ; pay | |
| `/recharger/resultat` | Oui | e2e | |
| `/profil` | Oui | unit (schémas) | demande de suppression ajoutée |

### Pages d'administration

| Page | Implémentée | Test | Remarque |
|---|---|---|---|
| `/admin` | Oui | sql (`admin_overview`) | |
| `/admin/competitions` | Partiel → corrigé | unit `actions.test.ts` | « saison courante » n'était qu'affichée : modifiable maintenant |
| `/admin/matchs` | Partiel → corrigé | unit `actions.test.ts` | « statut de synchronisation » ajouté (colonne Dernière synchro) |
| `/admin/matchs/[id]` | Oui | e2e admin (masquage) ; sql | |
| `/admin/pronostics` | Oui | revue | taux du filtre courant |
| `/admin/utilisateurs` | Oui | adm (recherche par e-mail) | |
| `/admin/utilisateurs/[id]` | Oui | e2e admin (ajustement) ; adm | |
| `/admin/tarifs` | Oui | e2e admin (changement de prix) ; unit (avertissement) | |
| `/admin/packs` | Oui | unit `actions.test.ts` | suppression refusée si acheté |
| `/admin/transactions` | Oui | unit `admin.test.ts` (CSV) | export CSV, contrôle de cohérence |
| `/admin/synchronisation` | Oui | sql (`admin_cron_status`) | |
| `/admin/ia` | Oui | sql (`admin_ai_stats`) | |
| `/admin/parametres` | Oui | unit `admin.test.ts` | |
| `/admin/journal` (ajoutée) | Oui | e2e admin | hors liste du cahier ; complète RG-F9-1 |

## 4. Définition du MVP terminé (section 12)

| Critère | État |
|---|---|
| Inscription, recharge simulée, déblocage, pronostic retrouvé résolu, sans intervention | Couvert par `tests/e2e/user-journey.spec.ts`. La résolution y est **simulée** ; en réel, la tâche `settle-predictions` la fait seule |
| Mises à jour seules pendant 7 jours sans erreur bloquante | **Non vérifiable dans cette phase** : la synchronisation réelle n'a pas encore tourné (secrets API-Football / OpenAI et variables Vercel manquants) |
| L'admin pilote compétitions, prix, packs et pronostics sans code | Oui (phase 10) ; `tests/e2e/admin.spec.ts` |
| Tests de sécurité sur les pronostics et les crédits | Écrits ; verts en requêtes réelles ; en CI dès l'ajout des secrets |

## 5. Hors périmètre (section 12)

Design, landing page, paiement réel (FedaPay / KkiaPay), notifications, nouveaux marchés, compétitions supplémentaires, applications mobiles, modèle statistique maison, parrainage / abonnements / codes promo : **non implémentés, conformément au cahier des charges**.
