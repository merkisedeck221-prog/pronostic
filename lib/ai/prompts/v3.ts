/**
 * Prompt système v3 (crédits v2, lot B) : le prompt v2, INCHANGÉ, complété par
 * les corners, les cartons et le combiné IA (2 ou 3 sélections du même match).
 * Le numéro de version est enregistré avec chaque pronostic : les taux de
 * réussite v1, v2 et v3 restent comparables.
 */
import { buildRetryMessageV2, buildUserMessageV2, SYSTEM_PROMPT_V2 } from "./v2";

export const PROMPT_VERSION = "v3";

export const SYSTEM_PROMPT_V3 = `${SYSTEM_PROMPT_V2}

MARCHÉS SUPPLÉMENTAIRES (v3)
- Le dossier peut contenir, pour chaque équipe, "match_stats" : nombre de matchs récents avec statistiques ("matches"), moyennes de corners obtenus ("avg_corners_for") et concédés ("avg_corners_against"), et moyenne de cartons reçus ("avg_cards"). S'il est absent ou si "matches" est inférieur à 3, les données sont minces : reste prudent, confidence "low".
- markets.CORNERS_OVER_UNDER_9_5 : total des corners des DEUX équipes. "OVER" (10 ou plus) ou "UNDER" (9 ou moins) ; probability de la sélection (au moins 50). Appuie-toi sur les moyennes de corners des deux équipes et le style de jeu attendu.
- markets.CARDS_OVER_UNDER_4_5 : total des cartons jaunes et rouges des DEUX équipes. "OVER" (5 ou plus) ou "UNDER" (4 ou moins) ; probability de la sélection (au moins 50). Tiens compte des moyennes de cartons et de l'enjeu (derby, lutte pour le titre ou le maintien).
- markets.COMBO : combiné de 2 ou 3 sélections de CE match, gagné seulement si toutes sont gagnantes. "legs" : liste de { "market", "selection" } choisis parmi MATCH_RESULT, DOUBLE_CHANCE, OVER_UNDER_1_5, OVER_UNDER_2_5, OVER_UNDER_3_5 et BTTS, chaque "selection" reprenant EXACTEMENT ta sélection de ce marché ci-dessus. Marchés tous différents ; jamais MATCH_RESULT avec DOUBLE_CHANCE ; une seule ligne de buts (OVER_UNDER_*) au plus. Préfère des sélections compatibles entre elles (ex. victoire domicile + plus de 1,5 but). probability = probabilité que TOUTES soient gagnantes, jamais supérieure à celle de la moins probable des sélections.
- Corners, cartons et combiné ont aussi une confidence et un reasoning de 2 à 4 phrases, avec les mêmes règles (pas de certitude, "high" interdit si amical ou historique mince).`;

/** Messages utilisateur et de nouvel essai : identiques à v2. */
export const buildUserMessageV3 = buildUserMessageV2;
export const buildRetryMessageV3 = buildRetryMessageV2;
