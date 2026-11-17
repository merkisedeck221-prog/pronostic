import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Espace administrateur · Pronostics IA" };

// Page minimale (phase 3) : le back-office complet arrive en phase 10.
export default async function AdminHomePage() {
  // Double vérification : la page ne dépend pas uniquement de la mise en page.
  const admin = await requireAdmin();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Espace administrateur</h1>
      <Card>
        <CardHeader>
          <CardTitle>Accès vérifié</CardTitle>
          <CardDescription>
            Connecté en tant que {admin.profile.display_name} ({admin.email}). Le rôle administrateur est vérifié
            côté serveur à chaque requête.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Le back-office complet (compétitions, matchs, pronostics, utilisateurs, tarifs, packs, transactions,
          synchronisation, suivi de l&apos;IA, paramètres) sera construit en phase 10.
        </CardContent>
      </Card>
    </main>
  );
}
