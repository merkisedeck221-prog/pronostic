import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { promoteIfAdminEmail } from "@/lib/auth/admin-promotion";
import { safeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * Retour des liens envoyés par e-mail (confirmation d'inscription, réinitialisation
 * du mot de passe). Deux formats sont acceptés :
 *   - ?code=…                 (flux PKCE, modèles d'e-mail par défaut de Supabase)
 *   - ?token_hash=…&type=…    (modèles d'e-mail personnalisés)
 * Puis redirection vers ?next= (chemin interne uniquement).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let userId: string | undefined;
  let email: string | undefined;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      userId = data.user?.id;
      email = data.user?.email;
    } else {
      console.error("[auth/callback] exchangeCodeForSession :", error.code, error.message);
    }
  } else if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      userId = data.user?.id;
      email = data.user?.email;
    } else {
      console.error("[auth/callback] verifyOtp :", error.code, error.message);
    }
  }

  if (!userId) {
    return NextResponse.redirect(new URL("/connexion?erreur=lien-invalide", origin));
  }

  await promoteIfAdminEmail(userId, email);

  return NextResponse.redirect(new URL(next, origin));
}
