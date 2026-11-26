import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/sign-in-form";
import { FormMessage } from "@/components/forms/fields";
import { safeNextPath } from "@/lib/auth/redirect";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Connexion · PRONEX" };

const ERRORS: Record<string, string> = {
  "lien-invalide":
    "Ce lien n'est plus valide (expiré, déjà utilisé ou ouvert dans un autre navigateur que celui de la demande). Reconnectez-vous ou demandez un nouveau lien.",
};

const INFOS: Record<string, string> = {
  "deconnexion-globale": "Vous êtes déconnecté de tous vos appareils.",
  "session-expiree": "Votre session a expiré. Reconnectez-vous pour continuer : vous reviendrez sur la page demandée.",
};

export default async function SignInPage({ searchParams }: PageProps<"/connexion">) {
  const params = await searchParams;
  const nextParam = typeof params.next === "string" ? params.next : undefined;
  const next = safeNextPath(nextParam);

  // Déjà connecté : on va directement à la page demandée.
  if (await getCurrentUser()) redirect(next);

  const errorKey = typeof params.erreur === "string" ? params.erreur : undefined;
  const errorMessage = errorKey ? ERRORS[errorKey] : undefined;
  const infoKey = typeof params.info === "string" ? params.info : undefined;
  const infoMessage = infoKey ? INFOS[infoKey] : undefined;

  return (
    <AuthCard
      title="Se connecter"
      footer={
        <p className="text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link href="/inscription" className="tap-target font-medium text-foreground underline underline-offset-4">
            S&apos;inscrire
          </Link>
        </p>
      }
    >
      <div className="space-y-4">
        <FormMessage status="error" message={errorMessage} />
        <FormMessage status="success" message={infoMessage} />
        <SignInForm next={nextParam ? next : undefined} />
      </div>
    </AuthCard>
  );
}
