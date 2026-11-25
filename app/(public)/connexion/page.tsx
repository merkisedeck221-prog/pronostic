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
  "lien-invalide": "Ce lien n'est plus valide (expiré ou déjà utilisé). Reconnectez-vous ou demandez un nouveau lien.",
};

export default async function SignInPage({ searchParams }: PageProps<"/connexion">) {
  const params = await searchParams;
  const nextParam = typeof params.next === "string" ? params.next : undefined;
  const next = safeNextPath(nextParam);

  // Déjà connecté : on va directement à la page demandée.
  if (await getCurrentUser()) redirect(next);

  const errorKey = typeof params.erreur === "string" ? params.erreur : undefined;
  const errorMessage = errorKey ? ERRORS[errorKey] : undefined;

  return (
    <AuthCard
      title="Se connecter"
      footer={
        <p className="text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link href="/inscription" className="font-medium text-foreground underline underline-offset-4">
            S&apos;inscrire
          </Link>
        </p>
      }
    >
      <div className="space-y-4">
        <FormMessage status="error" message={errorMessage} />
        <SignInForm next={nextParam ? next : undefined} />
      </div>
    </AuthCard>
  );
}
