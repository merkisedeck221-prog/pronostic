# lib/api-football

Client HTTP typé pour API-Football v3 (`https://v3.football.api-sports.io`), côté serveur uniquement.

- Authentification par l'en-tête `x-apisports-key` (`API_FOOTBALL_KEY`).
- Toutes les heures demandées en UTC (`timezone=UTC`).
- Gestion du quota : lecture du quota restant à chaque réponse, respect du plafond `API_FOOTBALL_DAILY_BUDGET`.
- Délai maximal et 2 essais par appel.
- Conversion des réponses vers nos tables (`competitions`, `teams`, `fixtures`, `standings`, `match_contexts`).

Les pages n'appellent jamais l'API directement : elles lisent la base (section 7).
