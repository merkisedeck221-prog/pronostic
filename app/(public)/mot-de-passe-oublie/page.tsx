import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/password-forms";

export const metadata: Metadata = { title: "Mot de passe oublié · PRONEX" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Mot de passe oublié"
      description="Saisissez votre adresse e-mail : nous vous enverrons un lien pour choisir un nouveau mot de passe."
      footer={
        <Link href="/connexion" className="underline underline-offset-4">
          Retour à la connexion
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
