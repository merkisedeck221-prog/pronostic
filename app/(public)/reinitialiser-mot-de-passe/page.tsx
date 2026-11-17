import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/password-forms";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Nouveau mot de passe · Pronostics IA" };

/**
 * Atteinte via le lien de réinitialisation : /auth/callback a ouvert une session
 * temporaire. Sans session, le lien a expiré ou a déjà servi.
 */
export default async function ResetPasswordPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <AuthCard
        title="Lien expiré"
        description="Ce lien de réinitialisation n'est plus valide (expiré ou déjà utilisé)."
      >
        <Link href="/mot-de-passe-oublie" className="text-sm font-medium underline underline-offset-4">
          Demander un nouveau lien
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Nouveau mot de passe" description={`Compte : ${user.email}`}>
      <ResetPasswordForm />
    </AuthCard>
  );
}
