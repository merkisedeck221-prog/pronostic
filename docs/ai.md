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
| `prompts/v2.ts` | **prompt utilisé** depuis le lot 4 : v1 + 6 marchés (double chance, mi-temps, mi-temps/fin de match, handicap ±1,5, plus/moins 1,5 et 3,5), `PROMPT_VERSION = 'v2'` |
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


1. Schéma Zod (types, entiers 0-100, 3 à 5 facteurs clés).
2. 1N2 : somme = 100 à ±1, puis normalisée à 100.
3. Sélection 1N2 = issue la plus probable.
4. OVER/UNDER et BTTS : probabilité de la sélection ≥ 50.
5. Score exact cohérent avec OVER/UNDER, BTTS **et** le 1N2.
6. Confiance `high` interdite si `is_friendly` ou historique mince (forme inconnue d'une équipe, ou < 2 confrontations sans classement).
7. Mots interdits dans tous les textes : sûr, garanti, certain et leurs variantes (sûrement, certitude, assurément…).

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
