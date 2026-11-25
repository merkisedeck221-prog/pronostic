"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDaysIcon, HouseIcon, TargetIcon, TrophyIcon, WalletIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const APP_NAV_ITEMS: readonly { href: string; label: string; short: string; icon: LucideIcon }[] = [
  { href: "/tableau-de-bord", label: "Tableau de bord", short: "Accueil", icon: HouseIcon },
  { href: "/matchs", label: "Matchs", short: "Matchs", icon: CalendarDaysIcon },
  { href: "/competitions", label: "Compétitions", short: "Ligues", icon: TrophyIcon },
  { href: "/mes-pronostics", label: "Mes pronostics", short: "Pronos", icon: TargetIcon },
  { href: "/portefeuille", label: "Portefeuille", short: "Crédits", icon: WalletIcon },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Navigation principale sur ordinateur et tablette (dans l'en-tête). */
export function AppNav({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale" className={cn("hidden items-center gap-1 lg:flex", className)}>
      {APP_NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative rounded-lg px-2.5 py-2 text-sm whitespace-nowrap xl:px-3 text-muted-foreground transition-colors hover:text-foreground",
              active && "text-foreground after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-linear-to-r after:from-pronex-pink after:to-pronex-violet",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Barre de navigation fixe en bas de l'écran, sur mobile uniquement. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-pronex-night/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {APP_NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors",
                  active && "text-pronex-pink",
                )}
              >
                <Icon className={cn("size-5", active && "drop-shadow-[0_0_6px_rgb(255_20_147_/_0.7)]")} aria-hidden />
                {item.short}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
