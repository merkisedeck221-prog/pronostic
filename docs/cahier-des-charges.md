# Application de pronostics IA — Cahier des charges

17 novembre 2026 · Merkisedeck DAGUE

> Version Markdown du cahier des charges (source : PDF de 34 pages fourni par le porteur du projet).
> Ce document est la référence de tout le projet.

---

## 1. Vision et résumé du projet

Le projet est une **application web de pronostics football générés par intelligence artificielle**, financée par un système de **crédits prépayés**. L'application récupère automatiquement le calendrier et les statistiques des matchs, fait analyser chaque match à venir par l'IA d'OpenAI, puis vend l'accès aux pronostics à l'unité.

### Le concept en une phrase

Un utilisateur recharge son compte en crédits, parcourt les championnats et les matchs à venir, et dépense des crédits pour débloquer les pronostics IA d'un match : résultat, score exact, nombre de buts, « les deux équipes marquent ».

### Proposition de valeur

- **Pour l'utilisateur** : une analyse argumentée et chiffrée de chaque match, basée sur des données réelles (forme, confrontations directes, classement, absences), sans passer des heures à étudier les statistiques.
- **Pour le projet** : un revenu à l'usage (crédits), un coût d'IA maîtrisé (chaque pronostic est généré une seule fois par match et revendu à tous les acheteurs) et une base technique prête à accueillir le mobile.

### Périmètre du MVP

- Les 5 grands championnats européens : Premier League, LaLiga, Serie A, Bundesliga, Ligue 1.
- Les compétitions internationales de sélections nationales : qualifications, Ligue des nations, CAN, matchs amicaux, etc.
- Une application web uniquement. Les applications Android et iOS viendront après.

### Principes directeurs

1. **Fonctionnalités d'abord, design ensuite.** Le MVP doit être complet et fluide avec une interface sobre (composants standards). Le design final et la landing page viendront dans une phase dédiée, à partir de ressources d'inspiration fournies par le porteur du projet.
2. **Simplicité au démarrage.** Une API de données (API-Football), une IA (OpenAI) et une infrastructure gérée (Supabase et Vercel). Pas de modèle statistique maison dans le MVP.
3. **Tout ce qui touche à l'argent est configurable et traçable.** Les prix, les packs et les règles de déblocage se règlent depuis l'administration. Chaque mouvement de crédits est journalisé.
4. **Sécurité par défaut.** Un pronostic payant n'est jamais lisible sans avoir été débloqué, même en interrogeant directement la base de données.
5. **Honnêteté.** L'application affiche des probabilités et un indice de confiance, jamais de « pronostic sûr ». Le taux de réussite réel est publié.
6. **Pilotage par Claude Code.** Le développement est confié à Claude Code, qui a accès à Supabase, GitHub et Vercel. Ce document lui sert de référence : il doit être placé dans le dépôt (voir l'onglet « Prompts Claude Code »).

---

## 2. Décisions validées

Toutes les décisions ci-dessous ont été prises lors de la phase de cadrage. Elles s'imposent à Claude Code.

| Sujet | Décision | Commentaire |
|---|---|---|
| Type d'application | Application web responsive (mobile d'abord) | Android et iOS après le MVP, en réutilisant le même backend |
| Framework | Next.js (App Router) + TypeScript strict | Rendu serveur, Server Actions, routes API |
| Interface | Tailwind CSS + shadcn/ui | Sobre et fonctionnelle ; refonte visuelle complète prévue plus tard |
| Base de données et authentification | Supabase (PostgreSQL, Auth, RLS, pg_cron) | Migrations SQL versionnées dans le dépôt |
| Code source | GitHub | Une branche par phase, fusion après validation |
| Hébergement | Vercel | Déploiement automatique à chaque push ; prévisualisation par branche |
| Données football | [API-Football](https://www.api-football.com/) (api-sports.io) | Toutes les compétitions et tous les endpoints sur tous les forfaits ; gratuit (100 requêtes/jour) en développement |
| Intelligence artificielle | API OpenAI | Analyse du dossier de chaque match et production d'un pronostic au format JSON structuré |
| Compétitions au lancement | 5 grands championnats + compétitions internationales de sélections | Liste activable et désactivable depuis l'administration |
| Langue de l'interface | Français | Le code et la base de données sont en anglais |
| Monnaie | Franc CFA (XOF) | Les packs de crédits sont facturés en XOF |
| Modèle économique | Crédits prépayés, débités à chaque déblocage | Tarification exacte à définir : le système doit supporter le prix par pronostic **et** le prix par match |
| Paiement | Recharge simulée pendant le MVP | Mobile Money (FedaPay ou KkiaPay) branché après le MVP, grâce à une couche « fournisseur de paiement » interchangeable |
| Génération des pronostics | Automatique, une fois par match, puis réutilisée | L'admin peut masquer, régénérer ou ajuster un pronostic tant que personne ne l'a acheté |
| Ordre de développement | Fonctionnalités, puis design, puis landing page | Le design sera fait à partir d'inspirations fournies plus tard |
| Pilotage | Claude Code, avec accès à Supabase, GitHub et Vercel | Le porteur de projet valide chaque phase avant la suivante |

---

## 3. Utilisateurs, rôles et parcours

L'application a trois profils d'accès : le visiteur, l'utilisateur inscrit et l'administrateur.

### Rôles

| Rôle | Qui | Ce qu'il peut faire |
|---|---|---|
| Visiteur | Personne non connectée | Voir la page d'accueil provisoire, la page « Performances » publique, les CGU et la page « Jeu responsable » ; s'inscrire, se connecter |
| Utilisateur | Compte inscrit (rôle `user`) | Parcourir compétitions et matchs, voir les informations gratuites d'un match, recharger des crédits, débloquer des pronostics, consulter ses pronostics, son portefeuille et son profil |
| Administrateur | Compte avec le rôle `admin` | Tout ce que fait l'utilisateur, plus le back-office : compétitions, matchs, pronostics, utilisateurs, crédits, tarifs, packs, synchronisation, suivi de l'IA, paramètres |

Le premier administrateur est désigné par son adresse e-mail dans une variable d'environnement (`ADMIN_EMAILS`) ou par une commande SQL documentée. Aucun utilisateur ne peut se donner lui-même le rôle `admin`.

### Parcours principal de l'utilisateur

1. **Découverte** : le visiteur arrive sur l'accueil provisoire, qui explique le service en quelques lignes et propose de s'inscrire.
2. **Inscription** : e-mail et mot de passe, nom d'affichage, pays, numéro de téléphone (facultatif, utile plus tard pour le Mobile Money), case à cocher obligatoire « J'ai 18 ans ou plus et j'accepte les CGU ». Un e-mail de confirmation est envoyé.
3. **Première connexion** : arrivée sur le tableau de bord. Un solde de bienvenue est crédité si l'admin l'a activé (montant configurable, 0 par défaut).
4. **Exploration** : liste des compétitions, puis liste des matchs à venir (filtres par date et par compétition), puis fiche d'un match.
5. **Fiche match, partie gratuite** : équipes, date, heure locale, stade, forme récente (5 derniers matchs), classement, dernières confrontations directes. C'est ce qui donne envie d'aller plus loin.
6. **Fiche match, partie payante** : la liste des pronostics disponibles (par exemple Résultat, Score exact, Plus/Moins de 2,5 buts, Les deux équipes marquent), chacun avec son prix en crédits et un cadenas.
7. **Déblocage** : l'utilisateur clique sur « Débloquer », une fenêtre de confirmation affiche le prix et le solde après débit, il confirme. Le pronostic s'affiche immédiatement : sélection, probabilité, indice de confiance et explication. Si le solde est insuffisant, il est redirigé vers la recharge.
8. **Recharge** : choix d'un pack (par exemple 10, 25 ou 60 crédits), paiement (simulé dans le MVP), retour sur la page d'où il venait avec le nouveau solde.
9. **Suivi** : la page « Mes pronostics » liste tout ce qu'il a débloqué, avec le statut « En attente », « Gagné » ou « Perdu » mis à jour automatiquement après chaque match.
10. **Fidélisation** : la page « Performances » montre le taux de réussite de l'IA par type de pronostic et par compétition, ce qui renforce la confiance.

### Parcours principal de l'administrateur

1. Activer les compétitions à couvrir et lancer une première synchronisation.
2. Vérifier que les matchs à venir apparaissent et que les pronostics sont générés automatiquement.
3. Relire un pronostic si besoin : le masquer, le régénérer ou modifier son texte avant qu'il soit acheté.
4. Régler les prix (par pronostic ou par match) et les packs de recharge.
5. Suivre les utilisateurs, les transactions, les erreurs de synchronisation et la consommation de l'IA.
6. Ajuster manuellement le solde d'un utilisateur (geste commercial, remboursement), avec un motif obligatoire.

---

## 4. Inventaire des pages du MVP

Le MVP compte 31 pages : 8 publiques, 10 pour l'utilisateur connecté et 13 pour l'administration. Les URL sont en français, et toutes les pages sont responsives (mobile d'abord).

### Pages publiques

| URL | Page | Contenu |
|---|---|---|
| `/` | Accueil provisoire | Titre, 3 lignes d'explication, boutons « S'inscrire » et « Se connecter ». Un utilisateur connecté est redirigé vers `/tableau-de-bord`. La vraie landing page viendra avec la phase design. |
| `/inscription` | Inscription | Formulaire décrit au parcours, étape 2 |
| `/connexion` | Connexion | E-mail et mot de passe, lien « Mot de passe oublié » |
| `/mot-de-passe-oublie` | Mot de passe oublié | Envoi d'un lien de réinitialisation |
| `/reinitialiser-mot-de-passe` | Réinitialisation | Saisie du nouveau mot de passe |
| `/performances` | Performances de l'IA | Taux de réussite global, par type de pronostic, par compétition et sur les 30 derniers jours ; liste des derniers pronostics terminés |
| `/cgu` | Conditions d'utilisation | Texte provisoire : aucune garantie de résultat, 18 ans minimum, crédits non remboursables sauf match annulé |
| `/jeu-responsable` | Jeu responsable | Texte provisoire et liens d'aide |

### Pages de l'utilisateur connecté

| URL | Page | Contenu |
|---|---|---|
| `/tableau-de-bord` | Tableau de bord | Solde de crédits, bouton « Recharger », matchs à venir dans les 48 h, derniers pronostics débloqués et leur statut |
| `/competitions` | Compétitions | Deux groupes : « Championnats » et « International » ; logo, nom, nombre de matchs à venir |
| `/competitions/[slug]` | Une compétition | Matchs à venir regroupés par journée ou par date, classement, derniers résultats |
| `/matchs` | Tous les matchs à venir | Sélecteur de date (aujourd'hui, demain, 7 jours), filtre par compétition, pastille « Pronostic disponible » |
| `/matchs/[id]` | Fiche match | Partie gratuite (infos, forme, classement, confrontations) et partie payante (pronostics verrouillés ou débloqués, analyse IA) ; après le match : score final et résultat de chaque pronostic |
| `/mes-pronostics` | Mes pronostics | Pronostics débloqués, filtres « À venir / Terminés », statut En attente, Gagné, Perdu ou Annulé |
| `/portefeuille` | Portefeuille | Solde et historique paginé des mouvements (recharges, déblocages, bonus, remboursements, ajustements) |
| `/recharger` | Recharge | Liste des packs actifs, choix du pack, paiement |
| `/recharger/resultat` | Résultat de la recharge | Succès, échec ou attente, nouveau solde, lien de retour |
| `/profil` | Profil | Nom d'affichage, pays, téléphone, changement de mot de passe, déconnexion |

### Pages d'administration (rôle `admin` uniquement)

| URL | Page | Contenu |
|---|---|---|
| `/admin` | Vue d'ensemble | Inscrits (total et 7 jours), crédits vendus et dépensés, chiffre d'affaires simulé, matchs à venir avec et sans pronostic, dernières erreurs |
| `/admin/competitions` | Compétitions | Activer ou désactiver, ordre d'affichage, saison courante, ajouter une compétition par son identifiant API-Football |
| `/admin/matchs` | Matchs | Liste filtrable, statut de synchronisation et de pronostic, publier ou masquer un match |
| `/admin/matchs/[id]` | Détail d'un match | Dossier de données envoyé à l'IA, pronostics générés, actions « Régénérer », « Masquer », « Modifier le texte », nombre d'achats |
| `/admin/pronostics` | Pronostics | Tous les pronostics, filtres par statut et par résultat, taux de réussite |
| `/admin/utilisateurs` | Utilisateurs | Recherche, solde, date d'inscription, nombre de déblocages, suspension |
| `/admin/utilisateurs/[id]` | Fiche utilisateur | Historique des transactions et des déblocages, ajustement de solde avec motif obligatoire |
| `/admin/tarifs` | Tarifs | Mode de tarification (par pronostic ou par match), prix par type de pronostic, prix du pack « match complet », surcharges par compétition |
| `/admin/packs` | Packs de recharge | Créer, modifier, activer ou désactiver : nom, crédits, bonus, prix en XOF, ordre |
| `/admin/transactions` | Transactions | Journal de tous les mouvements de crédits et de toutes les recharges, export CSV |
| `/admin/synchronisation` | Synchronisation | Historique des tâches (date, durée, appels API, erreurs), boutons de lancement manuel, quota API-Football restant |
| `/admin/ia` | Suivi de l'IA | Générations (succès ou échec), tokens consommés, coût estimé, version du prompt |
| `/admin/parametres` | Paramètres | Crédits de bienvenue, fenêtre de génération (heures avant le match), types de pronostics actifs, mode maintenance |

---

## 5. Fonctionnalités détaillées du MVP

Le MVP couvre 9 modules. Chacun est décrit par ce qu'il fait et par ses règles de gestion (RG), numérotées pour être citées dans les prompts et les tests.

### F1. Authentification et comptes

- Inscription par e-mail et mot de passe via Supabase Auth, avec confirmation de l'adresse e-mail.
- Connexion, déconnexion, mot de passe oublié, réinitialisation, changement de mot de passe depuis le profil.
- À la création du compte, un déclencheur SQL crée automatiquement le profil (`profiles`) et le portefeuille (`wallets`, solde 0).
- **RG-F1-1** : l'acceptation des CGU et la déclaration « 18 ans ou plus » sont obligatoires ; leur date est enregistrée.
- **RG-F1-2** : un compte suspendu (`is_banned`) ne peut plus se connecter aux pages privées ni débloquer de pronostic.
- **RG-F1-3** : le rôle `admin` ne peut être attribué que par la base de données ou par un autre administrateur, jamais par l'utilisateur lui-même.
- **RG-F1-4** : si les crédits de bienvenue sont activés, ils sont crédités une seule fois par compte, sous forme de transaction de type `bonus`.

### F2. Catalogue : compétitions et matchs

- Liste des compétitions actives, séparées entre « Championnats » et « International ».
- Liste des matchs à venir avec filtres par date et par compétition, tri chronologique.
- **RG-F2-1** : seuls les matchs des compétitions actives et marqués « publiés » sont visibles par les utilisateurs.
- **RG-F2-2** : les heures sont stockées en UTC et affichées dans le fuseau de l'utilisateur, par défaut `Africa/Porto-Novo` (UTC+1).
- **RG-F2-3** : un match reporté, annulé ou interrompu affiche clairement son statut.
- **RG-F2-4** : la fenêtre affichée par défaut couvre les 7 prochains jours (paramètre).

### F3. Fiche match, partie gratuite

- En-tête : compétition, journée ou phase, date et heure locale, stade, logos et noms des équipes.
- Forme récente : 5 derniers résultats de chaque équipe (V, N, D).
- Classement des deux équipes (rang, points, différence de buts) quand la compétition en a un.
- 5 dernières confrontations directes.
- Après le coup de sifflet final : score à la mi-temps et score final.
- **RG-F3-1** : la partie gratuite ne doit jamais révéler la sélection d'un pronostic, ni son explication.

### F4. Pronostics : types et affichage

Quatre types de pronostics (« marchés ») sont prévus pour le MVP. La liste est en base de données et activable par l'admin.

| Code | Nom affiché | Sélections possibles | Gagné si… |
|---|---|---|---|
| `MATCH_RESULT` | Résultat du match (1N2) | `1` (domicile), `N` (nul), `2` (extérieur) | le résultat au temps réglementaire correspond |
| `EXACT_SCORE` | Score exact | par exemple `2-1` | le score au temps réglementaire est identique |
| `OVER_UNDER_2_5` | Plus/Moins de 2,5 buts | `OVER`, `UNDER` | le total de buts au temps réglementaire est ≥ 3 (OVER) ou ≤ 2 (UNDER) |
| `BTTS` | Les deux équipes marquent | `YES`, `NO` | les deux équipes ont marqué au moins un but (YES), ou non (NO) |

Chaque pronostic affiche : la sélection en clair (« Victoire de Arsenal »), la probabilité estimée en % (pour le 1N2, les trois probabilités), l'indice de confiance (Faible, Moyen, Élevé) et une explication de 2 à 4 phrases. Une analyse globale du match (un paragraphe et 3 à 5 facteurs clés) accompagne l'ensemble.

- **RG-F4-1** : le temps réglementaire comprend le temps additionnel, mais exclut les prolongations et les tirs au but.
- **RG-F4-2** : avant déblocage, l'utilisateur voit seulement le nom du marché, son prix et un cadenas.
- **RG-F4-3** : un pronostic masqué par l'admin n'est ni visible ni achetable.
- **RG-F4-4** : après la fin du match, tous les pronostics publiés de ce match deviennent visibles par tous avec leur résultat (transparence et page Performances). *Décision à confirmer, voir les points ouverts.*

### F5. Déblocage d'un pronostic

- Bouton « Débloquer », fenêtre de confirmation (prix, solde actuel, solde après), puis affichage immédiat.
- Selon le mode de tarification choisi par l'admin : déblocage d'un seul marché, ou déblocage du « match complet » (tous les marchés actifs du match pour un prix groupé). Les deux modes peuvent coexister.
- **RG-F5-1** : le déblocage est une opération atomique côté base de données. Soit le débit et l'accès sont enregistrés ensemble, soit rien ne l'est.
- **RG-F5-2** : le solde ne peut jamais devenir négatif. Si le solde est insuffisant, l'opération est refusée et l'utilisateur est invité à recharger.
- **RG-F5-3** : un même pronostic ne peut pas être payé deux fois par le même utilisateur, même en cas de double clic. Un déblocage « match complet » ne facture pas les marchés déjà achetés : le prix est réduit d'autant, sans descendre sous 0.
- **RG-F5-4** : les déblocages ferment au coup d'envoi. Après, le bouton disparaît.
- **RG-F5-5** : le prix est calculé côté serveur au moment du déblocage, jamais envoyé par le navigateur.
- **RG-F5-6** : dès qu'un pronostic est acheté une première fois, il est figé. Il ne peut plus être régénéré ni modifié, sauf pour corriger une faute de frappe dans l'explication (historisée).
- **RG-F5-7** : si un match est annulé ou reporté de plus de 48 h, les crédits dépensés sur ce match sont remboursés automatiquement (transaction de type `refund`) et ses pronostics passent au résultat `void`.

### F6. Portefeuille et recharge

- Le solde est visible en permanence dans l'en-tête de l'application.
- La page Portefeuille liste toutes les transactions : date, type, libellé, montant (+ ou −), solde après.
- La recharge passe par un pack (crédits + bonus éventuel, prix en XOF) et par un « fournisseur de paiement ». Dans le MVP, le seul fournisseur est `mock` : une page de paiement simulée avec les boutons « Payer », « Échec » et « Annuler ».
- **RG-F6-1** : une recharge est créée au statut `pending`. Les crédits ne sont ajoutés qu'au passage à `succeeded`, une seule fois (idempotence sur la référence de paiement).
- **RG-F6-2** : le fournisseur de paiement est une interface (`PaymentProvider`) avec au minimum `createCheckout()` et `handleWebhook()`, pour brancher FedaPay ou KkiaPay sans toucher au reste du code.
- **RG-F6-3** : le fournisseur `mock` est désactivé automatiquement en production dès qu'un vrai fournisseur est configuré (variable `PAYMENT_PROVIDER`).
- **RG-F6-4** : chaque transaction stocke le solde après opération. La somme des transactions d'un utilisateur doit toujours égaler son solde ; un contrôle de cohérence est disponible dans l'admin.

### F7. Mes pronostics et résolution automatique

- Après chaque match terminé, une tâche calcule le résultat de chaque pronostic (`won`, `lost` ou `void`) à partir du score au temps réglementaire.
- La page « Mes pronostics » affiche les pronostics débloqués avec leur statut et le score final.
- **RG-F7-1** : la résolution ne s'exécute que sur un match au statut final (`FT`, `AET` ou `PEN` dans API-Football) et avec un score disponible.
- **RG-F7-2** : la résolution est idempotente : relancée, elle ne change rien.

### F8. Performances publiques

- Taux de réussite = pronostics gagnés / (gagnés + perdus), hors `void`.
- Vues : global, par type de pronostic, par compétition, 30 derniers jours, et liste des 20 derniers pronostics résolus.
- **RG-F8-1** : les chiffres sont calculés sur tous les pronostics publiés, achetés ou non. On ne choisit pas les meilleurs.

### F9. Administration

- Toutes les pages listées en section 4, protégées côté serveur par la vérification du rôle `admin`.
- **RG-F9-1** : toute action sensible de l'admin (ajustement de solde, modification de prix, régénération, masquage) est enregistrée dans un journal d'audit (`admin_audit_log`) : qui, quoi, quand, avant et après.
- **RG-F9-2** : un ajustement de solde exige un motif et ne peut pas rendre le solde négatif.
- **RG-F9-3** : les synchronisations et générations IA peuvent être lancées manuellement depuis l'admin, avec affichage du résultat.

---

## 6. Système de crédits et tarification

La tarification définitive n'est pas encore arrêtée. Le système doit donc tout rendre configurable depuis l'administration, sans redéploiement. Les valeurs ci-dessous sont des **valeurs de départ** (données d'amorçage), à ajuster librement.

### Principes

- **1 crédit = une unité entière.** Pas de décimales. Les crédits n'expirent pas dans le MVP.
- **Le solde est un registre.** Chaque mouvement est une ligne de `credit_transactions` (montant signé, solde après). Le solde de `wallets` n'est modifié que par des fonctions SQL sécurisées, jamais directement par l'application.
- **Types de transactions** : `topup` (recharge), `unlock` (déblocage), `bonus` (bienvenue ou promotion), `refund` (remboursement d'un match annulé), `admin_adjustment` (geste manuel, avec motif).

### Deux modes de tarification, cumulables

| Mode | Ce que l'utilisateur achète | Réglage |
|---|---|---|
| Par pronostic | Un seul marché d'un match (par exemple le Score exact) | Un prix par type de pronostic |
| Match complet | Tous les marchés actifs d'un match, plus l'analyse globale | Un prix groupé, en principe inférieur à la somme des marchés |

Un paramètre `pricing_mode` indique ce qui est proposé à l'utilisateur : `per_market`, `per_match` ou `both`. Valeur de départ : `both`.

### Règles de prix

Les prix sont stockés dans `pricing_rules`. Pour un match et un marché donnés, le prix retenu est le premier trouvé dans cet ordre :

1. une règle propre à la compétition du match (par exemple, la Ligue des nations plus chère) ;
2. la règle générale du marché ;
3. à défaut, le marché n'est pas achetable (et l'admin est alerté).

Valeurs de départ proposées :

| Élément | Prix de départ (crédits) |
|---|---|
| Résultat du match (1N2) | 2 |
| Plus/Moins de 2,5 buts | 2 |
| Les deux équipes marquent | 2 |
| Score exact | 3 |
| Match complet (les 4 marchés et l'analyse) | 7 |

### Packs de recharge

Les packs sont gérés dans `credit_packs`. Valeurs de départ, à remplacer par vos vrais prix :

| Pack | Crédits | Bonus | Prix (XOF) |
|---|---|---|---|
| Découverte | 10 | 0 | 1 000 |
| Standard | 25 | 3 | 2 500 |
| Premium | 60 | 10 | 5 000 |

### Autres paramètres (`app_settings`)

| Clé | Rôle | Valeur de départ |
|---|---|---|
| `pricing_mode` | Modes proposés à l'utilisateur | `both` |
| `welcome_credits` | Crédits offerts à l'inscription | 0 |
| `prediction_window_hours` | Délai avant le coup d'envoi à partir duquel le pronostic est généré | 48 |
| `refund_on_cancel` | Remboursement automatique des matchs annulés ou reportés | `true` |
| `maintenance_mode` | Bloque les déblocages et recharges, avec un message | `false` |
| `reveal_after_match` | Rend publics les pronostics d'un match terminé (RG-F4-4) | `true` |

### Exemple complet

Awa a 10 crédits. Elle débloque le Score exact d'Arsenal – Chelsea : 3 crédits, il lui en reste 7. Elle choisit ensuite le « Match complet » du même match : prix groupé 7, moins les 3 déjà payés pour le Score exact, soit 4 crédits (RG-F5-3). Il lui en reste 3. Le match est reporté de 5 jours : elle est remboursée de 7 crédits (RG-F5-7) et retrouve 10 crédits.

---

## 7. Données sportives : API-Football

Toutes les données de matchs viennent d'API-Football (api-sports.io, version 3). Elles sont copiées dans Supabase par des tâches planifiées. **Les pages de l'application ne contactent jamais l'API directement** : elles lisent la base, ce qui économise le quota et accélère l'affichage.

### Pourquoi API-Football

- Tous les forfaits incluent toutes les compétitions et tous les endpoints ([tarifs](https://www.api-football.com/pricing)) : plus de 400 compétitions nationales et internationales.
- Un forfait gratuit sans carte bancaire (100 requêtes par jour) pour développer, puis environ 19 $ par mois pour le forfait Pro (7 500 requêtes par jour), 29 $ pour Ultra et 39 $ pour Mega (tarifs RapidAPI).
- Un endpoint `/predictions` qui renvoie en un seul appel la forme récente, les confrontations directes, une comparaison des équipes et la propre prédiction d'API-Football : une matière première idéale pour OpenAI.
- Alternatives étudiées et écartées : football-data.org (pas de couverture claire des compétitions de sélections hors Coupe du monde et Euro), Sportmonks (prix par nombre de ligues, à partir de 29 € pour 5 ligues), TheStatsAPI (à partir de 50 $).

**À vérifier dès la création du compte** : selon API-Football, le forfait gratuit couvre les saisons récentes et les forfaits payants débloquent un historique plus profond (guide officiel). Si la saison en cours n'est pas accessible en gratuit, prendre le forfait Pro dès le développement.

### Connexion technique

- URL de base : `https://v3.football.api-sports.io`
- Authentification : en-tête `x-apisports-key: <API_FOOTBALL_KEY>` (clé côté serveur uniquement).
- Chaque réponse indique le quota restant ; il est enregistré et affiché dans `/admin/synchronisation`.
- Toutes les heures sont demandées en UTC (paramètre `timezone=UTC`).

### Compétitions au lancement

Les identifiants ci-dessous sont **indicatifs** : Claude Code doit les confirmer avec l'endpoint `/leagues` avant de les enregistrer, et récupérer la saison en cours de chacune (`/leagues?id=X&current=true`).

| Compétition | Catégorie | ID indicatif |
|---|---|---|
| Premier League (Angleterre) | Championnat | 39 |
| LaLiga (Espagne) | Championnat | 140 |
| Serie A (Italie) | Championnat | 135 |
| Bundesliga (Allemagne) | Championnat | 78 |
| Ligue 1 (France) | Championnat | 61 |
| Ligue des nations UEFA | International | 5 |
| Coupe d'Afrique des nations (CAN) | International | 6 |
| Qualifications CAN | International | 36 |
| Qualifications Coupe du monde (par confédération) | International | à rechercher via `/leagues?search=World Cup` |
| Matchs amicaux internationaux | International | 10 |
| Coupe du monde, Euro, Copa América | International | 1, 4, 9 (activées seulement quand une édition approche) |

Les compétitions de sélections jouent par fenêtres (septembre, octobre, novembre, mars, juin). Il est normal qu'elles n'aient aucun match à venir pendant plusieurs semaines. Les matchs amicaux ont peu de données fiables : l'IA doit y baisser son indice de confiance.

### Endpoints utilisés

| Endpoint | Usage | Stocké dans |
|---|---|---|
| `/leagues` | Compétitions, saison en cours, couverture des données | `competitions` |
| `/teams` | Équipes d'une compétition et d'une saison (nom, logo, pays) | `teams` |
| `/fixtures` | Calendrier, statuts et scores (par compétition et période, ou par lot d'identifiants avec `ids`) | `fixtures` |
| `/standings` | Classements | `standings` |
| `/predictions` | Forme récente, confrontations directes, comparaison, prédiction API-Football | `match_contexts` |
| `/injuries` | Joueurs blessés ou suspendus pour un match | `match_contexts` |
| `/fixtures/headtohead` | Confrontations directes, si `/predictions` ne suffit pas | `match_contexts` |
| `/status` | Quota du compte | `sync_runs` |

### Tâches planifiées

Les tâches sont déclenchées par **Supabase Cron (pg_cron + pg_net)**, qui appelle des routes protégées de l'application (`/api/cron/<tâche>`, en-tête `Authorization: Bearer <CRON_SECRET>`). Ce choix ne dépend pas des limites des tâches planifiées de l'offre Vercel. Chaque exécution est journalisée dans `sync_runs`.

| Tâche | Fréquence | Ce qu'elle fait | Appels API estimés |
|---|---|---|---|
| `sync-competitions` | 1 fois par semaine | Met à jour les compétitions actives, leur saison en cours et leurs équipes | ~2 par compétition |
| `sync-fixtures` | 2 fois par jour | Matchs des 14 prochains jours et des 3 derniers jours de chaque compétition active | 1 par compétition |
| `sync-standings` | 1 fois par jour | Classements des compétitions qui en ont | 1 par compétition |
| `sync-results` | Toutes les 15 min | Matchs commencés depuis moins de 4 h et non terminés ; s'arrête tout de suite s'il n'y en a aucun | 1 par lot de 20 matchs |
| `build-contexts` | Toutes les heures | Pour les matchs dans la fenêtre de génération sans dossier : appelle `/predictions` et `/injuries` | 2 par match |
| `generate-predictions` | Toutes les heures, après `build-contexts` | Envoie les dossiers à OpenAI, par lots de 5 matchs | 0 (OpenAI) |
| `settle-predictions` | Toutes les 15 min, après `sync-results` | Résout les pronostics des matchs terminés ; rembourse les matchs annulés ou reportés | 0 |

### Estimation du quota

Sur une semaine type, avec les 5 championnats et environ 50 matchs, l'usage estimé tourne autour de 60 à 120 requêtes par jour, avec des pics le week-end. *Ce chiffre est une estimation à confirmer par le suivi réel dans l'admin.*

- **Forfait gratuit (100/jour)** : suffisant pour développer si l'on active 2 ou 3 compétitions seulement.
- **Forfait Pro (7 500/jour)** : très confortable pour le lancement.
- Toutes les tâches doivent respecter un plafond quotidien configurable (`API_FOOTBALL_DAILY_BUDGET`) et s'arrêter proprement lorsqu'il est atteint.

---

## 8. Moteur de pronostic IA (OpenAI)

Pour le MVP, le moteur reste volontairement simple : l'application prépare un **dossier de match** en JSON, l'envoie à OpenAI avec des consignes strictes, et reçoit en retour un **pronostic au format JSON imposé**. Celui-ci est validé, puis enregistré. Chaque match est analysé une seule fois, et le résultat est revendu à tous les acheteurs.

### Le pipeline, étape par étape

1. **Sélection** : la tâche `build-contexts` repère les matchs publiés dont le coup d'envoi est dans moins de `prediction_window_hours` (48 h par défaut) et qui n'ont pas encore de dossier.
2. **Constitution du dossier** : appels à `/predictions` et `/injuries`, ajout du classement et des 5 derniers résultats déjà en base. Le dossier est enregistré dans `match_contexts` (JSON brut et JSON résumé).
3. **Génération** : la tâche `generate-predictions` envoie le dossier résumé à OpenAI, avec le prompt système versionné et le schéma de sortie.
4. **Validation** : la réponse est vérifiée (schéma Zod et règles de cohérence ci-dessous). En cas d'échec : 1 nouvel essai, puis statut `failed` et alerte dans l'admin.
5. **Enregistrement** : une ligne par marché dans `predictions` (statut `published`, résultat `pending`), l'analyse globale dans `prediction_analyses`, et les métriques (modèle, tokens, durée, coût estimé) dans `ai_generation_runs`.
6. **Vente** : les pronostics deviennent achetables sur la fiche match.
7. **Résolution** : après le match, `settle-predictions` calcule `won`, `lost` ou `void` (section 5, F7).

### Le dossier envoyé à l'IA (forme résumée)

```json
{
  "match": { "competition": "Premier League", "round": "Journée 13", "kickoff_utc": "2026-11-22T15:00:00Z", "venue": "Emirates Stadium", "is_neutral_venue": false, "competition_type": "league" },
  "home": { "name": "Arsenal", "rank": 2, "points": 27, "played": 12, "goals_for": 24, "goals_against": 9, "last5": "WWDWL", "home_record": { "w": 5, "d": 1, "l": 0 }, "avg_goals_for": 2.0, "avg_goals_against": 0.75, "absences": ["Joueur A (blessé)"] },
  "away": { "name": "Chelsea", "...": "même structure" },
  "head_to_head": [ { "date": "2026-04-12", "home": "Chelsea", "away": "Arsenal", "score": "1-1" } ],
  "provider_prediction": { "advice": "...", "percent": { "home": "45%", "draw": "30%", "away": "25%" }, "under_over": "-3.5" },
  "data_quality": { "has_standings": true, "h2h_count": 5, "is_friendly": false }
}
```

Les valeurs ci-dessus sont fictives et ne servent qu'à illustrer la structure.

### Le format de sortie imposé

La réponse est demandée en **sortie structurée stricte** (JSON Schema, fonctionnalité « Structured Outputs » d'OpenAI), puis validée par un schéma Zod identique.

```json
{
  "summary": "Analyse globale du match en un paragraphe (français).",
  "key_factors": ["Facteur 1", "Facteur 2", "Facteur 3"],
  "markets": {
    "MATCH_RESULT": { "selection": "1", "probabilities": { "home": 52, "draw": 26, "away": 22 }, "confidence": "medium", "reasoning": "2 à 4 phrases." },
    "EXACT_SCORE": { "selection": "2-1", "probability": 12, "confidence": "low", "reasoning": "..." },
    "OVER_UNDER_2_5": { "selection": "OVER", "probability": 58, "confidence": "medium", "reasoning": "..." },
    "BTTS": { "selection": "YES", "probability": 55, "confidence": "low", "reasoning": "..." }
  }
}
```

### Règles de cohérence vérifiées par le code

- Les probabilités sont des entiers de 0 à 100 ; pour le 1N2, leur somme vaut 100 (à ±1, puis normalisée).
- La sélection 1N2 correspond à la probabilité la plus élevée.
- Le score exact est cohérent avec les autres marchés (par exemple, un « 2-1 » implique OVER et YES). Une incohérence entraîne un nouvel essai.
- `confidence` vaut `low`, `medium` ou `high`. `high` est interdit si `data_quality.is_friendly` est vrai ou si l'historique est trop mince.
- Les textes sont en français, sans promesse de gain, sans les mots « sûr », « garanti » ou « certain ».

### Consignes du prompt système (à rédiger par Claude Code dans `lib/ai/prompts/v1.ts`)

- Rôle : analyste football rigoureux, qui s'appuie **uniquement** sur les données du dossier.
- Interdiction d'inventer des joueurs, des blessures, des transferts ou des statistiques absents du dossier.
- Prise en compte : avantage du terrain (sauf terrain neutre), forme récente, classement, buts marqués et encaissés, confrontations directes, absences, nature de la compétition (amical, phase à élimination directe).
- La prédiction d'API-Football est un indice parmi d'autres, pas une réponse à recopier.
- Ton factuel et pédagogique, phrases courtes, français.

### Paramètres et coûts

- Le modèle est choisi par variable d'environnement (`OPENAI_MODEL`). Pour démarrer, prendre un modèle récent et économique de la gamme OpenAI qui prend en charge les sorties structurées, puis comparer la qualité sur une vingtaine de matchs.
- Température basse (environ 0,3) pour des réponses stables.
- Chaque prompt porte un numéro de version (`prompt_version`), enregistré avec chaque pronostic, pour mesurer l'effet d'un changement sur le taux de réussite.
- **Maîtrise des coûts** : un seul appel par match, quel que soit le nombre d'acheteurs ; un plafond quotidien de générations (`AI_DAILY_GENERATION_LIMIT`) ; le suivi des tokens et du coût estimé dans `/admin/ia`.

### Actions de l'admin sur un pronostic

| Action | Possible si… | Effet |
|---|---|---|
| Régénérer | aucun achat sur ce match | Nouveau dossier et nouvelle génération ; l'ancienne version est archivée |
| Masquer | toujours | Le marché n'est plus visible ni achetable ; les acheteurs existants le conservent |
| Modifier le texte | toujours (faute de frappe, formulation) | L'explication est corrigée et la modification historisée ; la sélection et les probabilités restent figées dès le premier achat |

---

## 9. Architecture technique

L'application est un monolithe Next.js hébergé sur Vercel, adossé à Supabase. Les services externes (API-Football et OpenAI) ne sont appelés que côté serveur, par des tâches planifiées.

### Briques et responsabilités

| Brique | Rôle |
|---|---|
| Navigateur | Affiche les pages ; ne connaît que la clé publique Supabase |
| Next.js sur Vercel | Pages (rendu serveur), Server Actions (déblocage, recharge, actions admin), routes `/api/cron/*` et `/api/payments/*` |
| Supabase Auth | Comptes, sessions, e-mails de confirmation et de réinitialisation |
| Supabase PostgreSQL | Toutes les données ; RLS sur chaque table ; fonctions SQL `SECURITY DEFINER` pour les crédits |
| Supabase Cron | Déclenche les tâches planifiées en appelant les routes `/api/cron/*` |
| API-Football | Source des compétitions, matchs, scores, classements et dossiers |
| OpenAI | Génère les pronostics à partir des dossiers |
| Fournisseur de paiement | `mock` dans le MVP ; FedaPay ou KkiaPay ensuite |

### Conventions de code

- TypeScript en mode strict ; aucun `any` non justifié.
- Lecture des données dans les composants serveur ; écritures via Server Actions ou fonctions SQL ; validation de toutes les entrées avec Zod.
- Trois clients Supabase : navigateur (clé publique), serveur (clé publique et session de l'utilisateur), administrateur (clé secrète, réservé aux tâches planifiées et aux webhooks, jamais importé côté client).
- Types TypeScript générés depuis le schéma Supabase et régénérés après chaque migration.
- Interface en français ; code, tables et colonnes en anglais.
- Tests : Vitest pour la logique métier (prix, résolution, validation IA, fournisseur de paiement), et un test de bout en bout (Playwright) du parcours « inscription, recharge, déblocage ».

### Structure du projet

```
app/
  (public)/                 accueil, connexion, inscription, performances, cgu, jeu-responsable
  (app)/                    pages de l'utilisateur connecté (en-tête avec solde)
  admin/                    back-office (mise en page protégée par le rôle admin)
  api/
    cron/[job]/route.ts     tâches planifiées, protégées par CRON_SECRET
    payments/webhook/[provider]/route.ts
components/
  ui/                       composants shadcn/ui
  matches/  predictions/  wallet/  admin/
lib/
  supabase/                 clients navigateur, serveur et admin
  api-football/             client HTTP typé, gestion du quota, conversion vers nos tables
  sync/                     une fonction par tâche de synchronisation
  ai/                       dossier de match, prompts versionnés, appel OpenAI, validation Zod
  credits/                  appels aux fonctions SQL de crédits et calcul de prix
  payments/                 interface PaymentProvider et fournisseur mock
  settle/                   résolution des pronostics
  utils/                    dates, fuseaux horaires, formatage
supabase/
  migrations/               SQL versionné
  seed.sql                  marchés, tarifs, packs et paramètres de départ
types/                      types générés depuis Supabase
docs/
  cahier-des-charges.md     ce document, exporté en Markdown
  PROGRESS.md               journal d'avancement tenu par Claude Code
CLAUDE.md                   mémoire et règles du projet pour Claude Code
```

### Variables d'environnement

| Variable | Où | Rôle |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client et serveur | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client et serveur | Clé publique (« anon » ou « publishable » selon le projet) |
| `SUPABASE_SERVICE_ROLE_KEY` | Serveur uniquement | Clé secrète pour les tâches et webhooks |
| `NEXT_PUBLIC_APP_URL` | Client et serveur | URL publique de l'application |
| `API_FOOTBALL_KEY` | Serveur uniquement | Clé API-Football |
| `API_FOOTBALL_DAILY_BUDGET` | Serveur uniquement | Plafond quotidien d'appels (90 en gratuit, par exemple 5 000 en Pro) |
| `OPENAI_API_KEY` | Serveur uniquement | Clé OpenAI |
| `OPENAI_MODEL` | Serveur uniquement | Modèle utilisé pour les pronostics |
| `AI_DAILY_GENERATION_LIMIT` | Serveur uniquement | Nombre maximum de matchs analysés par jour |
| `CRON_SECRET` | Serveur et Supabase Cron | Secret partagé qui protège `/api/cron/*` |
| `ADMIN_EMAILS` | Serveur uniquement | E-mails promus administrateurs à l'inscription |
| `PAYMENT_PROVIDER` | Serveur uniquement | `mock` dans le MVP |
| `DEFAULT_TIMEZONE` | Client et serveur | `Africa/Porto-Novo` |

Un fichier `.env.example` liste toutes ces variables, sans valeur. Les vraies valeurs vont dans `.env.local` (jamais commité) et dans les réglages du projet Vercel.

### Environnements

- **Développement et prévisualisation** : un projet Supabase « dev », les déploiements de prévisualisation de Vercel (une URL par branche) et le forfait API-Football gratuit.
- **Production** : un second projet Supabase « prod », créé au moment du lancement et alimenté par les mêmes migrations ; la branche `main` sur Vercel ; le forfait API-Football Pro.

### Schéma d'architecture (7 briques)

Seul le serveur parle à API-Football, à OpenAI et au paiement.

```
Navigateur ──connexion──► Supabase Auth
    │
 pages et actions
    ▼
Application Next.js (Vercel) ◄──données──► Supabase PostgreSQL (RLS, fonctions SQL des crédits)
  - pages en rendu serveur      ◄──déclenche── Supabase Cron
  - Server Actions : déblocage, recharge
  - /api/cron/*, /api/payments/*
    │ synchronisation   │ génération     │ paiement et webhook
    ▼                   ▼                ▼
 API-Football         OpenAI          Paiement (simulé, puis Mobile Money)
```

Le navigateur ne parle qu'à l'application Next.js et à l'authentification Supabase. Les clés d'API-Football, d'OpenAI et du paiement ne quittent jamais le serveur.

---

## 10. Modèle de données (Supabase)

La base compte 20 tables réparties en 5 domaines. Toutes ont une clé primaire, des dates `created_at` et `updated_at`, et la RLS activée. Les colonnes listées sont les principales ; Claude Code complète les index et les contraintes.

### Comptes

| Table | Rôle | Colonnes principales | Accès |
|---|---|---|---|
| `profiles` | Profil lié à `auth.users` | `id` (= user id), `display_name`, `country`, `phone`, `role` (`user` ou `admin`), `is_banned`, `terms_accepted_at`, `timezone` | Lecture et modification de son propre profil (sauf `role` et `is_banned`) ; tout pour l'admin |
| `admin_audit_log` | Journal des actions admin | `admin_id`, `action`, `entity`, `entity_id`, `before` (jsonb), `after` (jsonb), `reason` | Admin en lecture ; écriture par fonctions serveur |

### Données football

| Table | Rôle | Colonnes principales | Accès |
|---|---|---|---|
| `competitions` | Compétitions suivies | `api_league_id` (unique), `name`, `slug`, `category` (`club_league` ou `international`), `type` (`league` ou `cup`), `country`, `logo_url`, `current_season`, `is_active`, `sort_order` | Lecture publique des actives ; écriture admin et tâches |
| `teams` | Équipes et sélections | `api_team_id` (unique), `name`, `short_name`, `country`, `logo_url`, `is_national` | Lecture publique |
| `fixtures` | Matchs | `api_fixture_id` (unique), `competition_id`, `season`, `round`, `kickoff_at` (UTC), `status_short`, `status_long`, `home_team_id`, `away_team_id`, `goals_home`, `goals_away`, `ht_home`, `ht_away`, `ft_home`, `ft_away`, `venue`, `is_published`, `original_kickoff_at`, `last_synced_at` | Lecture publique des matchs publiés |
| `standings` | Classements | `competition_id`, `season`, `group_name`, `team_id`, `rank`, `points`, `played`, `won`, `drawn`, `lost`, `goals_for`, `goals_against`, `form` | Lecture publique |
| `match_contexts` | Dossier de chaque match | `fixture_id` (unique), `raw` (jsonb), `summary` (jsonb), `fetched_at` | Admin uniquement (le dossier contient la prédiction d'API-Football) |

### Pronostics

| Table | Rôle | Colonnes principales | Accès |
|---|---|---|---|
| `markets` | Types de pronostics | `code` (clé), `label`, `description`, `is_active`, `sort_order` | Lecture publique |
| `predictions` | Un pronostic par match et par marché | `fixture_id`, `market_code`, `selection`, `selection_label`, `probability`, `probabilities` (jsonb, pour le 1N2), `confidence`, `reasoning`, `status` (`published` ou `hidden`), `result` (`pending`, `won`, `lost` ou `void`), `is_locked`, `version`, `prompt_version`, `settled_at` ; unique (`fixture_id`, `market_code`) | **Aucune lecture directe** pour les utilisateurs : accès par la fonction `get_fixture_predictions` ; admin en lecture et écriture |
| `prediction_analyses` | Analyse globale du match | `fixture_id` (unique), `summary`, `key_factors` (jsonb), `model`, `prompt_version` | Même règle que `predictions` (incluse dans « match complet ») |
| `prediction_revisions` | Historique des modifications et régénérations | `prediction_id`, `previous` (jsonb), `changed_by`, `reason` | Admin uniquement |
| `ai_generation_runs` | Suivi des appels OpenAI | `fixture_id`, `status` (`success` ou `failed`), `model`, `prompt_version`, `input_tokens`, `output_tokens`, `cost_estimate_usd`, `duration_ms`, `error` | Admin uniquement |

### Crédits et paiements

| Table | Rôle | Colonnes principales | Accès |
|---|---|---|---|
| `wallets` | Solde de chaque utilisateur | `user_id` (clé), `balance` (entier, `CHECK >= 0`) | Lecture de son propre solde ; **aucune écriture directe** |
| `credit_transactions` | Registre de tous les mouvements | `user_id`, `type` (`topup`, `unlock`, `bonus`, `refund` ou `admin_adjustment`), `amount` (signé), `balance_after`, `reference_type`, `reference_id`, `description`, `created_by` | Lecture de ses propres lignes ; aucune écriture directe |
| `unlocks` | Accès achetés | `user_id`, `fixture_id`, `market_code` (vide si « match complet »), `credits_spent`, `transaction_id`, `refunded_at` ; unicité sur (`user_id`, `fixture_id`, `market_code`), valeur vide comprise | Lecture de ses propres lignes ; aucune écriture directe |
| `pricing_rules` | Prix | `scope` (`market` ou `match_bundle`), `market_code`, `competition_id` (vide = règle générale), `credits`, `is_active` | Lecture publique ; écriture admin |
| `credit_packs` | Packs de recharge | `name`, `credits`, `bonus_credits`, `price_xof`, `is_active`, `sort_order` | Lecture publique des actifs ; écriture admin |
| `topups` | Recharges | `user_id`, `pack_id`, `credits`, `bonus_credits`, `amount_xof`, `provider`, `provider_ref` (unique), `status` (`pending`, `succeeded`, `failed` ou `cancelled`), `completed_at` | Lecture de ses propres lignes ; écriture serveur |

### Pilotage

| Table | Rôle | Colonnes principales | Accès |
|---|---|---|---|
| `app_settings` | Paramètres (section 6) | `key` (clé), `value` (jsonb), `description` | Lecture publique des clés non sensibles ; écriture admin |
| `sync_runs` | Journal des tâches | `job`, `status`, `started_at`, `finished_at`, `api_calls`, `items_processed`, `quota_remaining`, `error` | Admin uniquement |

### Fonctions SQL clés (`SECURITY DEFINER`)

| Fonction | Rôle |
|---|---|
| `handle_new_user()` | Déclencheur : crée le profil et le portefeuille, crédite le bonus de bienvenue (la promotion admin via `ADMIN_EMAILS` se fait côté serveur, à la connexion) |
| `get_unlock_price(fixture_id, market_code)` | Calcule le prix selon les règles de la section 6, en déduisant ce qui est déjà acheté |
| `unlock_prediction(fixture_id, market_code)` | Déblocage atomique : vérifie le compte, le statut du match, le coup d'envoi, la disponibilité et le non-doublon ; verrouille le portefeuille (`FOR UPDATE`), débite, enregistre la transaction et l'accès, fige le pronostic |
| `get_fixture_predictions(fixture_id)` | Renvoie les marchés du match : complets s'ils sont débloqués (ou si le match est terminé), sinon seulement le code, le nom et le prix |
| `apply_topup(topup_id)` | Passe une recharge à `succeeded` et crédite le compte, une seule fois |
| `admin_adjust_balance(user_id, amount, reason)` | Ajustement manuel, réservé aux admins, journalisé |
| `refund_fixture(fixture_id)` | Rembourse tous les déblocages d'un match annulé ou reporté |
| `settle_fixture(fixture_id)` | Calcule le résultat de chaque pronostic d'un match terminé |

Les fonctions accessibles aux utilisateurs s'appuient sur `auth.uid()` et n'acceptent jamais un identifiant d'utilisateur en paramètre. Les fonctions réservées au serveur (`apply_topup`, `refund_fixture`, `settle_fixture`) ne sont exécutables qu'avec la clé secrète.

---

## 11. Sécurité, fiabilité et conformité

Les deux risques majeurs sont la lecture gratuite des pronostics payants et la manipulation des crédits. Les règles ci-dessous sont **non négociables** et doivent être testées.

### Protection des pronostics payants

- La clé publique Supabase est visible dans le navigateur. N'importe qui peut donc interroger la base directement. La protection doit se trouver dans la base (RLS et fonctions), pas seulement dans l'interface.
- Aucune politique RLS ne permet à un utilisateur de lire `predictions`, `prediction_analyses` ou `match_contexts`. Seule la fonction `get_fixture_predictions` renvoie un contenu, et uniquement celui qui a été débloqué (ou celui d'un match terminé, si RG-F4-4 est confirmée).
- **Test obligatoire** : avec un compte sans déblocage, une requête directe sur `predictions` via l'API REST de Supabase doit renvoyer une liste vide.
- Les pages ne mettent jamais en cache côté serveur un contenu débloqué qui pourrait être servi à un autre utilisateur.

### Intégrité des crédits

- Aucune politique RLS d'écriture sur `wallets`, `credit_transactions` et `unlocks` : toutes les écritures passent par les fonctions SQL de la section 10.
- Verrouillage de la ligne du portefeuille (`SELECT … FOR UPDATE`) pendant un débit, pour éviter les doubles dépenses en cas de clics simultanés.
- Contrainte `CHECK (balance >= 0)` et contraintes d'unicité sur `unlocks` et `topups.provider_ref` : même en cas de bug applicatif, la base refuse l'incohérence.
- **Tests obligatoires** : double déblocage simultané (un seul débit), solde insuffisant (refus), déblocage après le coup d'envoi (refus), recharge confirmée deux fois (un seul crédit), remboursement d'un match annulé.

### Secrets et accès

- Les clés API-Football, OpenAI et Supabase secrète ne sont utilisées que dans du code serveur. Un contrôle (`import 'server-only'`) empêche leur import côté client.
- Les routes `/api/cron/*` refusent toute requête sans le bon `CRON_SECRET`.
- Le webhook de paiement vérifie la signature du fournisseur (pour le `mock` : un secret interne).
- Les pages et actions d'administration vérifient le rôle `admin` côté serveur, pas seulement en masquant des liens.
- Le répertoire `.env*` est exclu de Git ; un `.env.example` documente les variables sans valeur.

### Fiabilité

- Les tâches planifiées sont idempotentes (relançables sans effet de bord) et traitées par petits lots, pour rester sous la durée maximale d'exécution des fonctions Vercel.
- Chaque appel externe a un délai maximal et une reprise limitée (2 essais, avec attente). Une erreur n'arrête jamais tout le lot : elle est journalisée et le lot continue.
- Toutes les erreurs de synchronisation et d'IA sont visibles dans l'admin. Un tableau « à surveiller » liste les matchs du jour sans pronostic.
- Un contrôle de cohérence admin vérifie que, pour chaque utilisateur, la somme des transactions égale le solde.

### Conformité et communication

- L'application vend des **analyses**, pas des paris. Elle ne prend aucune mise et ne verse aucun gain. Le porteur du projet doit tout de même vérifier le cadre applicable au Bénin, et dans chaque pays visé, avant le lancement commercial.
- Mentions affichées en pied de page et sur chaque fiche match : « Les pronostics sont des estimations, sans garantie de résultat. Réservé aux 18 ans et plus. »
- CGU provisoires : nature du service, absence de garantie, âge minimum, règles des crédits (pas d'expiration, remboursement uniquement en cas d'annulation ou de report), suspension en cas d'abus.
- Données personnelles : le strict minimum (e-mail, nom d'affichage, pays, téléphone facultatif). L'utilisateur peut demander la suppression de son compte (traitement manuel par l'admin dans le MVP).

---

## 12. Feuille de route du MVP

Le MVP se construit en 13 phases (de 0 à 12), chacune liée à un prompt Claude Code de l'onglet « Prompts Claude Code ». Une phase n'est lancée que lorsque la précédente est validée.

| Phase | Livrable | Critère de validation |
|---|---|---|
| 0. Préparation (vous) | Comptes et clés : GitHub, Vercel, Supabase, API-Football, OpenAI | Toutes les clés sont réunies et Claude Code accède à GitHub, Vercel et Supabase |
| 1. Initialisation | Projet Next.js, `CLAUDE.md`, dépôt GitHub, déploiement Vercel | L'URL Vercel affiche l'accueil provisoire |
| 2. Base de données | Les 20 tables, la RLS, les fonctions SQL, les données de départ | Les migrations passent ; les tests de sécurité SQL sont au vert |
| 3. Authentification | Inscription, connexion, mot de passe, profil, rôles | Un compte se crée avec profil et portefeuille ; les pages privées et admin sont protégées |
| 4. Synchronisation | Client API-Football, tâches `sync-*`, Supabase Cron, journal | Les matchs des 14 prochains jours apparaissent en base ; le quota est respecté |
| 5. Catalogue | Compétitions, matchs à venir, fiche match gratuite | Navigation complète jusqu'à la fiche d'un match réel |
| 6. Moteur IA | Dossiers, prompt v1, appel OpenAI, validation, stockage | Les matchs à moins de 48 h ont leurs 4 pronostics, cohérents et en français |
| 7. Crédits et déblocage | Portefeuille, prix, déblocage par marché et par match | Les 5 tests obligatoires de la section 11 passent |
| 8. Recharge simulée | Packs, fournisseur `mock`, page de résultat | Une recharge simulée crédite le compte une seule fois |
| 9. Résolution et suivi | `settle-predictions`, remboursements, Mes pronostics, Performances | Un match terminé met à jour les statuts ; les taux affichés sont justes |
| 10. Administration | Les 13 pages admin et le journal d'audit | Toutes les actions de la section 4 fonctionnent et sont journalisées |
| 11. Recette | Tests automatisés, audit de sécurité, corrections | Le parcours complet est testé de bout en bout ; aucune faille connue |
| 12. Mise en production | Projet Supabase prod, variables Vercel, forfait API-Football Pro, domaine | L'application tourne en production avec de vraies données |

### Définition du MVP terminé

- Un nouvel utilisateur peut s'inscrire, recharger (simulé), débloquer un pronostic et le retrouver résolu après le match, sans intervention manuelle.
- Les matchs, scores et pronostics se mettent à jour seuls pendant 7 jours consécutifs sans erreur bloquante.
- L'admin pilote les compétitions, les prix, les packs et les pronostics sans toucher au code.
- Les tests de sécurité sur les pronostics et les crédits passent.

### Hors périmètre du MVP (phases suivantes)

1. **Design et refonte visuelle** de toute l'interface, à partir de vos inspirations.
2. **Landing page** marketing.
3. **Paiement réel** par Mobile Money (FedaPay ou KkiaPay).
4. **Notifications** : e-mails ou push (rappel avant un match, résultat d'un pronostic).
5. **Nouveaux marchés** : buteurs, corners, cartons, mi-temps.
6. **Compétitions supplémentaires** : Ligue des champions, Ligue Europa, championnats africains.
7. **Applications Android et iOS.**
8. **Modèle statistique maison** combiné à l'IA, pour améliorer la précision.
9. **Parrainage, abonnements, codes promo.**

### Points ouverts à trancher

- [ ] Tarification définitive : prix par pronostic, prix du match complet, et mode proposé (`per_market`, `per_match` ou les deux).
- [ ] Contenu et prix en XOF des packs de recharge.
- [ ] Rendre publics les pronostics après la fin du match (RG-F4-4) : oui ou non.
- [ ] Ajouter la Ligue des champions dès le MVP (une simple activation dans l'admin).
- [ ] Choisir FedaPay ou KkiaPay pour le Mobile Money.
- [ ] Nom de l'application, nom de domaine, identité visuelle.
- [ ] Cadre légal applicable au Bénin et dans les pays visés.
- [ ] Choisir une offre Vercel compatible avec un usage commercial avant le lancement (l'offre gratuite est prévue pour un usage personnel, à vérifier).
- [ ] Vérifier que le forfait gratuit d'API-Football donne accès à la saison en cours ; sinon, passer au Pro dès le développement.
- [ ] Choisir le modèle OpenAI définitif après un test sur une vingtaine de matchs.

### Sources

- [API-Football – tarifs](https://www.api-football.com/pricing)
- API-Football sur RapidAPI – tarifs
- API-Football – guide de démarrage
- Sportmonks – comparatif avec API-Football
- football-data.org – revue et tarifs (sportsapis.dev)
