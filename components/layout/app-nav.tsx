"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const APP_NAV_ITEMS = [
  { href: "/tableau-de-bord", label: "Tableau de bord" },
  { href: "/matchs", label: "Matchs" },
  { href: "/competitions", label: "Compétitions" },
  { href: "/mes-pronostics", label: "Mes pronostics" },
  { href: "/portefeuille", label: "Portefeuille" },
] as const;

/** Navigation principale ; défile horizontalement sur mobile. */
export function AppNav({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale" className={cn("flex gap-1 overflow-x-auto", className)}>
      {APP_NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap text-muted-foreground hover:bg-muted hover:text-foreground",
              active && "bg-muted font-medium text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
