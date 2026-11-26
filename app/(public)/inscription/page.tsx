import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Inscription · PRONEX" };

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect("/tableau-de-bord");

  return (
    <AuthCard
      title="Créer un compte"
      description="Inscrivez-vous pour débloquer les pronostics de l'IA."
      footer={
        <p className="text-muted-foreground">
          Déjà inscrit ?{" "}
          <Link href="/connexion" className="tap-target font-medium text-foreground underline underline-offset-4">
            Se connecter
          </Link>
        </p>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}
