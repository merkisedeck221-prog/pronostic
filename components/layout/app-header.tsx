import Link from "next/link";
import { AppNav } from "@/components/layout/app-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { buttonVariants } from "@/components/ui/button";
import { formatCredits } from "@/lib/utils/format";

/** En-tête de l'espace connecté : nom, navigation, solde, menu utilisateur. */
export function AppHeader({
  displayName,
  balance,
  isAdmin,
}: {
  displayName: string;
  balance: number | null;
  isAdmin: boolean;
}) {
  return (
    <header className="border-b">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 pt-3">
        <Link href="/tableau-de-bord" className="font-semibold tracking-tight">
          Pronostics IA
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/portefeuille"
            className={buttonVariants({ variant: "outline", size: "sm" })}
            aria-label={balance === null ? "Solde indisponible" : `Solde : ${formatCredits(balance)}`}
          >
            {balance === null ? "— crédits" : formatCredits(balance)}
          </Link>
          <UserMenu displayName={displayName} isAdmin={isAdmin} />
        </div>
      </div>
      <AppNav className="mx-auto w-full max-w-5xl px-3 py-2" />
    </header>
  );
}
