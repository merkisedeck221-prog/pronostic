# lib/credits

Accès aux fonctions SQL de crédits (`get_unlock_price`, `unlock_prediction`, `admin_adjust_balance`…) et logique de prix (section 6).

Règle absolue : l'application n'écrit **jamais** directement dans `wallets`, `credit_transactions` ou `unlocks`. Tout passe par les fonctions SQL `SECURITY DEFINER`. Le prix est toujours calculé côté serveur, jamais reçu du navigateur.
