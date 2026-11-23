import Link from "next/link";
import { BellIcon } from "lucide-react";
import { AppNav } from "@/components/layout/app-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCredits } from "@/lib/utils/format";

/** En-tête de l'espace connecté : nom, navigation, solde, notifications, menu utilisateur. */
export function AppHeader({
  displayName,
  balance,
  isAdmin,
  unreadCount = 0,
}: {
  displayName: string;
  balance: number | null;
  isAdmin: boolean;
  unreadCount?: number;
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
          <Link
            href="/notifications"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "relative")}
            aria-label={unreadCount > 0 ? `Notifications : ${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : "Notifications"}
          >
            <BellIcon aria-hidden />
            {unreadCount > 0 ? (
              <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] leading-4 text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </Link>
          <UserMenu displayName={displayName} isAdmin={isAdmin} />
        </div>
      </div>
      <AppNav className="mx-auto w-full max-w-5xl px-3 py-2" />
    </header>
  );
}
