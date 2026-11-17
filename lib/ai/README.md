# lib/ai

Moteur de pronostic IA (section 8) :

- construction du **dossier de match** (JSON résumé envoyé à OpenAI) ;
- prompts système **versionnés** dans `prompts/` (`v1.ts`, `v2.ts`…) ;
- appel OpenAI en sortie structurée stricte (JSON Schema), modèle choisi par `OPENAI_MODEL` ;
- validation de la réponse par un schéma Zod et des règles de cohérence (probabilités, score exact cohérent, confiance) ;
- suivi des tokens, de la durée et du coût dans `ai_generation_runs`.

Côté serveur uniquement (`OPENAI_API_KEY`).
