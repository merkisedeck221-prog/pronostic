/** En-tête interne posé par proxy.ts : chemin demandé (pour ?next= après connexion). */
export const PATHNAME_HEADER = "x-pathname";

/**
 * En-tête interne posé par proxy.ts : « 1 » si la requête portait un cookie de
 * session Supabase AVANT son rafraîchissement (un cookie expiré ou corrompu est
 * effacé par le rafraîchissement). Sert uniquement au message « Session expirée ».
 */
export const HAD_SESSION_HEADER = "x-had-session";
