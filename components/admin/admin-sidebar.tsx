"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDownIcon, MenuIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ADMIN_BACK_LINK, ADMIN_NAV, ADMIN_NAV_GROUPS, isAdminNavActive, type AdminNavItem } from "./nav";

function NavLink({ item, active }: { item: AdminNavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground",
        active && "bg-linear-to-r from-pronex-pink/20 to-pronex-violet/10 font-semibold text-foreground",
      )}
    >
      {active ? <span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-pronex-pink" /> : null}
      <Icon className={cn("size-4 shrink-0", active ? "text-pronex-pink" : "text-muted-foreground")} aria-hidden />
      {item.label}
    </Link>
  );
}

function NavList({ pathname }: { pathname: string }) {
  return (
    <div className="space-y-4">
      {ADMIN_NAV_GROUPS.map((group) => (
        <div key={group.title ?? "root"} className="space-y-1">
          {group.title ? <p className="px-3 text-[11px] font-semibold tracking-[0.2em] text-muted-foreground/70 uppercase [html.light_&]:text-muted-foreground">{group.title}</p> : null}
          {group.items.map((item) => (
            <NavLink key={item.href} item={item} active={isAdminNavActive(item.href, pathname)} />
          ))}
        </div>
      ))}
      <div className="border-t border-white/10 pt-3">
        <NavLink item={ADMIN_BACK_LINK} active={false} />
      </div>
    </div>
  );
}

/**
 * Admin navigation: fixed sidebar from md up, collapsible menu on phones
 * (closed again after each navigation thanks to key={pathname}).
 */
export function AdminSidebar() {
  const pathname = usePathname();
  const current = ADMIN_NAV.find((item) => isAdminNavActive(item.href, pathname));
  const CurrentIcon = current?.icon ?? MenuIcon;
  return (
    <nav aria-label="Administration">
      <details key={pathname} className="group rounded-xl border border-white/10 bg-card md:hidden">
        <summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <CurrentIcon className="size-4 text-pronex-pink" aria-hidden />
          <span className="flex-1">{current?.label ?? "Menu"}</span>
          <span className="text-xs font-normal text-muted-foreground">Menu</span>
          <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="border-t border-white/10 p-2">
          <NavList pathname={pathname} />
        </div>
      </details>
      <div className="sticky top-20 hidden md:block">
        <NavList pathname={pathname} />
      </div>
    </nav>
  );
}
