import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

// Accueil provisoire (section 4). La vraie landing page viendra avec la phase design.
export default async function HomePage() {
  // Un utilisateur connecté va directement à son tableau de bord.
  if (await getCurrentUser()) redirect("/tableau-de-bord");

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-8 px-4 py-16">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Pronostics IA</h1>
        <div className="space-y-2 text-muted-foreground">
          <p>
            Chaque match des grands championnats européens et des compétitions de sélections est
            analysé par une intelligence artificielle, à partir de données réelles.
          </p>
          <p>
            Pour chaque match : résultat, score exact, nombre de buts et « les deux équipes
            marquent », avec probabilités, indice de confiance et explication.
          </p>
          <p>
            Rechargez votre compte en crédits et débloquez uniquement les pronostics qui vous
            intéressent.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/inscription" className={cn(buttonVariants({ size: "lg" }), "sm:flex-1")}>
          S&apos;inscrire
        </Link>
        <Link
          href="/connexion"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "sm:flex-1")}
        >
          Se connecter
        </Link>
      </div>

      <p className="text-sm text-muted-foreground">
        Réservé aux 18 ans et plus. Pronostics sans garantie de résultat.
      </p>
    </main>
  );
}
