/**
 * Traduction des erreurs de Supabase Auth en messages français pour l'utilisateur.
 * Les messages ne révèlent jamais si une adresse e-mail possède un compte.
 */

type AuthLikeError = { code?: string | null; message?: string | null; status?: number | null };

const MESSAGES: Record<string, string> = {
  invalid_credentials: "E-mail ou mot de passe incorrect.",
  email_not_confirmed:
    "Votre adresse e-mail n'est pas encore confirmée. Cliquez sur le lien reçu par e-mail, puis reconnectez-vous.",
  over_email_send_rate_limit:
    "Trop d'e-mails envoyés pour le moment. Patientez quelques minutes avant de réessayer.",
  over_request_rate_limit: "Trop de tentatives. Patientez quelques minutes avant de réessayer.",
  weak_password: "Ce mot de passe est trop faible. Choisissez-en un plus long ou plus varié.",
  same_password: "Le nouveau mot de passe doit être différent de l'ancien.",
  signup_disabled: "Les inscriptions sont momentanément fermées.",
  user_banned: "Ce compte est suspendu.",
  session_not_found: "Votre session a expiré. Reconnectez-vous.",
  otp_expired: "Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau.",
};

export const GENERIC_ERROR = "Une erreur est survenue. Réessayez dans quelques instants.";

export function authErrorMessage(error: AuthLikeError | null | undefined): string {
  if (!error) return GENERIC_ERROR;
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code];
  if (error.status === 429) return MESSAGES.over_request_rate_limit;
  return GENERIC_ERROR;
}
