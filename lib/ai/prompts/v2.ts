/**
 * Prompt système v2 (crédits v2, lot 4) : le prompt v1, INCHANGÉ, complété par
 * six marchés (double chance, mi-temps, mi-temps/fin de match, handicap ±1,5,
 * plus/moins 1,5 et 3,5). Le numéro de version est enregistré avec chaque
 * pronostic : les taux de réussite v1 et v2 restent comparables.
 */
import { buildRetryMessageV1, buildUserMessageV1, SYSTEM_PROMPT_V1 } from "./v1";

export const PROMPT_VERSION = "v2";

export const SYSTEM_PROMPT_V2 = `${SYSTEM_PROMPT_V1}

MARCHÉS SUPPLÉMENTAIRES (v2)
- markets.DOUBLE_CHANCE : selection "1N" (domicile ou nul), "12" (pas de nul) ou "N2" (nul ou extérieur). Choisis la paire qui EXCLUT l'issue la moins probable de MATCH_RESULT ; probability = somme des deux probabilités correspondantes de MATCH_RESULT.
- markets.HT_RESULT : résultat à la MI-TEMPS. selection "1" (domicile mène), "N" (égalité) ou "2" (extérieur mène) ; probabilities : trois entiers home, draw, away dont la somme vaut EXACTEMENT 100 ; la sélection est l'issue la plus probable. À la pause, l'égalité est souvent plus probable qu'en fin de match.
- markets.HT_FT : combinaison "mi-temps/fin de match" parmi "1/1", "1/N", "1/2", "N/1", "N/N", "N/2", "2/1", "2/N", "2/2". Elle reprend OBLIGATOIREMENT ta sélection HT_RESULT puis ta sélection MATCH_RESULT (ex. HT_RESULT "N" et MATCH_RESULT "1" → "N/1") ; probability = probabilité de cette combinaison, jamais supérieure à celle de chacune des deux parties (en général entre 10 et 35).
- markets.HANDICAP : handicap européen de 1,5 but, au temps réglementaire. "HOME_-1.5" (domicile gagne par 2 buts d'écart ou plus), "AWAY_+1.5" (extérieur ne perd pas par 2 buts d'écart ou plus), "HOME_+1.5" (domicile ne perd pas par 2 buts d'écart ou plus), "AWAY_-1.5" (extérieur gagne par 2 buts d'écart ou plus). Choisis la sélection la plus probable (probability au moins 50). Cohérence avec MATCH_RESULT : "HOME_-1.5" est moins probable que la victoire domicile ; "AWAY_-1.5" moins probable que la victoire extérieur ; "HOME_+1.5" au moins aussi probable que « domicile ou nul » ; "AWAY_+1.5" au moins aussi probable que « nul ou extérieur ».
- markets.OVER_UNDER_1_5 : "OVER" (2 buts ou plus) ou "UNDER" (0 ou 1 but) ; probability de la sélection (au moins 50).
- markets.OVER_UNDER_3_5 : "OVER" (4 buts ou plus) ou "UNDER" (3 buts ou moins) ; probability de la sélection (au moins 50).
- Lignes de buts cohérentes : la probabilité de « plus de 1,5 » est supérieure ou égale à celle de « plus de 2,5 », elle-même supérieure ou égale à celle de « plus de 3,5 ».
- Chaque marché supplémentaire a aussi une confidence et un reasoning de 2 à 4 phrases, avec les mêmes règles (pas de certitude, "high" interdit si amical ou historique mince).`;

/** Messages utilisateur et de nouvel essai : identiques à v1. */
export const buildUserMessageV2 = buildUserMessageV1;
export const buildRetryMessageV2 = buildRetryMessageV1;
