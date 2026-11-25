import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/auth/password-forms";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileForm } from "@/components/auth/profile-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signOutAction } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Profil · PRONEX" };

export default async function ProfilePage() {
  const user = await requireUser();
  const { profile } = user;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <PageHeader title="Mon profil" description="Vos informations, votre mot de passe et votre compte." />

      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
          <CardDescription>Adresse e-mail : {user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            defaults={{
              displayName: profile.display_name,
              country: profile.country,
              phone: profile.phone,
              timezone: profile.timezone,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mot de passe</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Déconnexion</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={signOutAction}>
            <Button type="submit" variant="outline">
              Se déconnecter
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Supprimer mon compte</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Vous pouvez demander la suppression de votre compte et de vos données personnelles (e-mail, nom d&apos;affichage,
          pays, téléphone) en écrivant au support depuis l&apos;adresse e-mail de votre compte. La demande est traitée à la
          main par un administrateur. Les crédits restants ne sont pas remboursables.
        </CardContent>
      </Card>
    </main>
  );
}
