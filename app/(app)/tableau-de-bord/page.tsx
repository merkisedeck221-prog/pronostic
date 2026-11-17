import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { formatCredits } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Tableau de bord · Pronostics IA" };

// Version minimale (phase 3). Matchs à venir et derniers pronostics : phase 9.
export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: wallet } = await supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle();

  const links = [
    { href: "/matchs", label: "Voir les matchs à venir" },
    { href: "/competitions", label: "Parcourir les compétitions" },
    { href: "/mes-pronostics", label: "Mes pronostics" },
    { href: "/profil", label: "Mon profil" },
  ];

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Bonjour {user.profile.display_name}</h1>

      <Card>
        <CardHeader>
          <CardDescription>Votre solde</CardDescription>
          <CardTitle className="text-3xl">{wallet ? formatCredits(wallet.balance) : "—"}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/recharger" className={buttonVariants()}>
            Recharger
          </Link>
          <Link href="/portefeuille" className={buttonVariants({ variant: "outline" })}>
            Historique
          </Link>
        </CardContent>
      </Card>

      <nav aria-label="Raccourcis" className="grid gap-2 sm:grid-cols-2">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "justify-start")}>
            {link.label}
          </Link>
        ))}
      </nav>
    </main>
  );
}
