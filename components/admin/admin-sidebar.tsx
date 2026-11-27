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
        "relative flex min-h-10 items-center gap-2.5 rounded-full px-3.5 py-2 text-[15px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        active && "bg-[#042644] font-medium text-[#fff] hover:bg-[#042644] hover:text-[#fff]",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active ? "text-[#c9f13e]" : "text-muted-foreground")} aria-hidden />
      {item.label}
    </Link>
  );
}

function NavList({ pathname }: { pathname: string }) {
  return (
    <div className="space-y-4">
      {ADMIN_NAV_GROUPS.map((group) => (
        <div key={group.title ?? "root"} className="space-y-1">
          {group.title ? <p className="px-3.5 pt-1 text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">{group.title}</p> : null}
          {group.items.map((item) => (
            <NavLink key={item.href} item={item} active={isAdminNavActive(item.href, pathname)} />
          ))}
        </div>
      ))}
      <div className="border-t border-border pt-3">
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
      <details key={pathname} className="group rounded-[20px] border border-border bg-card md:hidden">
        <summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <span className="flex size-8 items-center justify-center rounded-full bg-[#042644] text-[#c9f13e]"><CurrentIcon className="size-4" aria-hidden /></span>
          <span className="flex-1">{current?.label ?? "Menu"}</span>
          <span className="text-xs font-normal text-muted-foreground">Menu</span>
          <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="border-t border-border p-2">
          <NavList pathname={pathname} />
        </div>
      </details>
      <div className="sticky top-24 hidden rounded-[20px] border border-border bg-card p-3 shadow-[0_18px_40px_-30px_rgb(4_38_68/0.35)] md:block">
        <NavList pathname={pathname} />
      </div>
    </nav>
  );
}
