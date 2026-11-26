# Moteur de pronostic IA

Référence : [cahier des charges](cahier-des-charges.md), section 8. Code : `lib/ai/`.

## Pipeline

```
build-contexts (toutes les heures, :11)
  matchs publiés, compétition active, non commencés, coup d'envoi < prediction_window_hours, sans dossier
  └─ lib/ai/context/build.ts : /predictions + /injuries (si couverts, garde-fou budgétaire)
     + classement et derniers résultats en base
     → match_contexts.raw (brut) et match_contexts.summary (format section 8)

generate-predictions (toutes les heures, :31)
  matchs avec dossier et SANS pronostic, par lots de 5, ≤ AI_DAILY_GENERATION_LIMIT matchs/jour
  └─ lib/ai/pipeline.ts
       generate.ts : OpenAI (OPENAI_MODEL), sortie structurée stricte, température 0,3, 60 s max
       validate.ts : règles de cohérence ; en cas d'échec UN nouvel essai avec les erreurs, sinon « failed »
       save_ai_generation() (SQL, une transaction) : predictions (marchés actifs) + prediction_analyses + ai_generation_runs
```

Un match qui a déjà des pronostics n'est **jamais** régénéré automatiquement (refus dans la fonction SQL). Un match en échec 2 fois dans la journée n'est plus retenté avant le lendemain.

## Fichiers

| Fichier | Rôle |
|---|---|
| `context/schemas.ts` | Zod des réponses `/predictions` et `/injuries` |
| `context/summarize.ts` | résumeur **pur** → dossier au format section 8 (`match`, `home`, `away`, `head_to_head`, `provider_prediction`, `data_quality`) ; `isThinHistory()` |
| `context/build.ts` | `buildMatchContext(db, api, fixtureId)` : appels API, lecture base, enregistrement |
| `prompts/v1.ts` | prompt système v1 (4 marchés), conservé tel quel |
| `prompts/v3.ts` | **prompt utilisé** depuis le lot B : v2 + corners (plus/moins 9,5), cartons (plus/moins 4,5) et combiné IA (2 ou 3 sélections du même match), `PROMPT_VERSION = 'v3'` |
| `prompts/v2.ts` | prompt du lot 4 : v1 + 6 marchés (double chance, mi-temps, mi-temps/fin de match, handicap ±1,5, plus/moins 1,5 et 3,5), `PROMPT_VERSION = 'v2'` |
| `schema.ts` | schéma Zod de sortie (source unique) → `toOpenAiJsonSchema()` (JSON Schema strict) |
| `validate.ts` | règles de cohérence et mots interdits |
| `labels.ts` | libellés français (« Victoire d'Arsenal », « Plus de 2,5 buts »…) |
| `pricing.ts` | tarifs par modèle (USD / million de tokens) et coût estimé |
| `generate.ts` | appel OpenAI + validation + nouvel essai |
| `pipeline.ts` | `generateForFixture()` : dossier → IA → enregistrement / trace d'échec |
| `actions.ts` | `regeneratePredictions(fixtureId)` (admin, phase 10) |

### Format du dossier (`match_contexts.summary`)

Conforme à l'exemple de la section 8. Précisions :

- `home.home_record` = bilan à domicile de l'équipe qui reçoit ; `away.away_record` = bilan à l'extérieur de l'équipe qui se déplace (même structure `{w, d, l}`).
- `last5` : du plus ancien au plus récent ; source : matchs terminés en base, sinon classement, sinon `/predictions`.
- `is_neutral_venue` : heuristique (phase finale d'un tournoi de sélections : CAN, Coupe du monde, Euro, Copa América) ; API-Football ne fournit pas l'information.
- `absences` : « Nom (absent : raison) » ou « Nom (incertain : raison) », uniquement depuis `/injuries`.

### Règles de validation

Règles v2 ajoutées : double chance = paire qui exclut l'issue la moins probable (probabilité recalculée) ; mi-temps : somme 100 et sélection la plus probable ; mi-temps/fin de match = HT_RESULT puis MATCH_RESULT, pas plus probable que ses parties ; handicap cohérent avec le 1N2 ; P(plus de 1,5) ≥ P(plus de 2,5) ≥ P(plus de 3,5) ; marchés binaires ≥ 50 %. Pas de cohérence imposée entre le score exact et les lignes 1,5 / 3,5 ou le handicap (contrainte irréaliste pour l'IA).

Règles v3 ajoutées : corners et cartons ≥ 50 % ; **confiance « low » imposée** (sans erreur) si l'une des équipes a moins de 3 matchs récents avec statistiques (`match_stats` du dossier, `isThinMatchStats`) ; combiné = 2 ou 3 sélections reprenant **exactement** celles de l'IA, marchés distincts, jamais 1N2 + double chance, une seule ligne de buts, probabilité ≤ celle de la sélection la moins probable. Enregistré sous la forme `MATCH_RESULT:1+OVER_UNDER_1_5:OVER`.


1. Schéma Zod (types, entiers 0-100, 3 à 5 facteurs clés).
2. 1N2 : somme = 100 à ±1, puis normalisée à 100.
3. Sélection 1N2 = issue la plus probable.
4. OVER/UNDER et BTTS : probabilité de la sélection ≥ 50.
5. Score exact cohérent avec OVER/UNDER, BTTS **et** le 1N2.
6. Confiance `high` interdite si `is_friendly` ou historique mince (forme inconnue d'une équipe, ou < 2 confrontations sans classement).
7. Mots interdits dans tous les textes : sûr, garanti, certain et leurs variantes (sûrement, certitude, assurément…).

Règles v4 ajoutées (étape 5, `lib/ai/prompts/v4.ts`, prompt v3 inchangé + bloc « qualité des données et rigueur ») :

- **Dossier** : `data_quality.availability` classe chaque source `reliable` / `partial` / `unavailable` (forme, classement, confrontations, moyennes de buts, corners / cartons, absences, prédiction du fournisseur) ; `insufficient_data` = ni forme, ni classement, ni confrontation ; `notes` en clair. Absences : `reliable` seulement si `/injuries` a réellement été interrogé (`injuriesChecked`), une liste vide signifie alors « aucune absence signalée ».
- **Confiance cohérente avec la probabilité** (`CONFIDENCE_FLOORS`, `maxConfidenceFor`) : une confiance trop élevée est **abaissée** automatiquement (jamais relevée), sans nouvel appel ; seuils par marché (ex. 1N2 : high ≥ 60, medium ≥ 45 ; OVER/UNDER, BTTS, handicap, corners, cartons : 70 / 57 ; double chance : 80 / 65 ; score exact : 25 / 14 ; mi-temps/fin : 40 / 25 ; combiné : 55 / 40 ; mi-temps : 55 / 40).
- **Données insuffisantes** : toutes les confidences abaissées à `low`.
- **Contradiction** : P(les deux équipes marquent) ≤ P(plus de 1,5 but) (toujours vrai mathématiquement). La décision v2 est conservée : pas de cohérence imposée entre le score exact (issue la plus probable) et les lignes 1,5 / 3,5.
- **Aucune certitude** : chaque probabilité (y compris chaque issue du 1N2 et de la mi-temps) entre 1 et 99 %.
- **Explications** : 40 à 1 000 caractères ; le prompt exige un élément chiffré du dossier quand il existe et interdit d'évoquer une source `unavailable` comme connue.
- **Expressions interdites** ajoutées : « 100 % », « sans risque », « gain assuré », « argent facile », « à tous les coups », « les yeux fermés », « imparable », « infaillible », « immanquable ».
- Les corrections automatiques sont renvoyées dans `ValidationResult.adjustments` et journalisées (`[ai] corrections de confiance`).
- Limite assumée : la compatibilité fine entre le texte d'une explication et les chiffres du dossier n'est pas vérifiable automatiquement de façon fiable ; elle repose sur le prompt, le schéma strict et les contrôles ci-dessus.

### Régénération (admin)

`regeneratePredictions(fixtureId, reason?)` : refusée s'il existe au moins un déblocage ou un pronostic figé (RG-F5-6) ; sinon reconstruit le dossier, régénère, archive l'ancienne version (pronostic + analyse) dans `prediction_revisions`, incrémente `version`, journalise dans `admin_audit_log`.

## Configuration

| Variable | Rôle |
|---|---|
| `OPENAI_API_KEY` | clé OpenAI (serveur uniquement) |
| `OPENAI_MODEL` | modèle (récent, économique, compatible Structured Outputs) — **obligatoire** |
| `AI_DAILY_GENERATION_LIMIT` | nombre maximum de matchs analysés par jour (défaut 20) |
| `OPENAI_PRICE_INPUT_PER_MTOK`, `OPENAI_PRICE_OUTPUT_PER_MTOK` | facultatifs : tarifs (USD / million de tokens) si le modèle n'est pas dans `pricing.ts` |

Les tarifs de `pricing.ts` sont **indicatifs** : à vérifier sur la page de tarifs d'OpenAI.

## Lancer une génération réelle

- Workflow GitHub « API-Football (lancement manuel) », tâche `ai-sample` (3 matchs, compétitions différentes si possible) : secrets `API_FOOTBALL_KEY`, `OPENAI_API_KEY`, `SUPABASE_DEV_*` et variable de dépôt `OPENAI_MODEL`. Le rapport (`ai-sample-report.json` : JSON obtenu, tokens, coût) est dans le résumé et l'artefact de l'exécution.
- En local : `npm run ai:sample` (avec `.env.local` du projet DEV).

## Suivi

```sql
select fixture_id, status, model, prompt_version, input_tokens, output_tokens, cost_estimate_usd, duration_ms, left(error, 200), created_at
from public.ai_generation_runs order by created_at desc limit 20;
```
