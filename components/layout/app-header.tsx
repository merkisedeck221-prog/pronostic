import Link from "next/link";
import { BellIcon, CoinsIcon } from "lucide-react";
import { AppNav } from "@/components/layout/app-nav";
import { Brand } from "@/components/layout/brand";
import { UserMenu } from "@/components/layout/user-menu";
import { cn } from "@/lib/utils";
import { formatCredits } from "@/lib/utils/format";

/** En-tête de l'espace connecté : logo, navigation (ordinateur), solde, notifications, menu utilisateur. */
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
    <header className="sticky top-0 z-40 border-b border-white/10 bg-pronex-night/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-6">
          <Brand href="/tableau-de-bord" compact />
          <AppNav />
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href="/recharger"
            className="flex items-center gap-1.5 rounded-full border border-pronex-pink/40 bg-pronex-pink/10 px-3 py-1.5 text-sm font-semibold tabular-nums transition-colors hover:border-pronex-pink hover:bg-pronex-pink/20"
            aria-label={balance === null ? "Solde indisponible : acheter des crédits" : `Solde : ${formatCredits(balance)}. Acheter des crédits`}
          >
            <CoinsIcon className="size-4 text-pronex-pink" aria-hidden />
            {balance === null ? "—" : balance}
            <span className="hidden font-normal text-muted-foreground sm:inline">{balance !== null && Math.abs(balance) <= 1 ? "crédit" : "crédits"}</span>
          </Link>
          <Link
            href="/notifications"
            className={cn("relative flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground")}
            aria-label={unreadCount > 0 ? `Notifications : ${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : "Notifications"}
          >
            <BellIcon className="size-5" aria-hidden />
            {unreadCount > 0 ? (
              <span className="absolute top-0.5 right-0.5 min-w-4 rounded-full bg-pronex-pink px-1 text-center text-[10px] leading-4 font-semibold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </Link>
          <UserMenu displayName={displayName} isAdmin={isAdmin} />
        </div>
      </div>
    </header>
  );
}
