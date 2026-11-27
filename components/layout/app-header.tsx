import Link from "next/link";
import { BellIcon, CoinsIcon } from "lucide-react";
import { AppNav } from "@/components/layout/app-nav";
import { Brand } from "@/components/layout/brand";
import { ThemeToggle } from "@/components/layout/theme-toggle";
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
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-4 sm:pt-4">
      <div className="pxa-dark mx-auto flex h-[58px] w-full max-w-[1140px] items-center justify-between gap-3 rounded-[30px] bg-[#042644]/95 pr-2 pl-4 shadow-[0_18px_40px_-24px_rgb(4_38_68/0.7)] backdrop-blur-md sm:pl-5">
        <div className="flex min-w-0 shrink-0 items-center gap-4 xl:gap-6">
          <Brand href="/tableau-de-bord" compact className="text-[#fff] [&_svg]:h-7" />
          <AppNav />
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href="/recharger"
            className="flex h-9 items-center gap-1.5 rounded-full bg-[#c9f13e] px-3 text-sm font-semibold text-[#000] tabular-nums transition-colors hover:bg-[#d6f84f] pointer-coarse:h-11"
            aria-label={balance === null ? "Solde indisponible : acheter des crédits" : `Solde : ${formatCredits(balance)}. Acheter des crédits`}
          >
            <CoinsIcon className="size-4" aria-hidden />
            {balance === null ? "—" : balance}
            <span className="hidden font-normal text-[#000]/70 sm:inline lg:hidden xl:inline">{balance !== null && Math.abs(balance) <= 1 ? "crédit" : "crédits"}</span>
          </Link>
          <ThemeToggle />
          <Link
            href="/notifications"
            className={cn("relative flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground")}
            aria-label={unreadCount > 0 ? `Notifications : ${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : "Notifications"}
          >
            <BellIcon className="size-5" aria-hidden />
            {unreadCount > 0 ? (
              <span className="absolute top-0.5 right-0.5 min-w-[1.125rem] rounded-full bg-[#c9f13e] px-1 text-center text-[11px] leading-[1.125rem] font-semibold text-[#000]">
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
