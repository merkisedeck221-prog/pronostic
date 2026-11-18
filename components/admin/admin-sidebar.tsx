"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ADMIN_NAV } from "./nav";

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <nav aria-label="Administration" className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {ADMIN_NAV.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground hover:bg-muted hover:text-foreground",
              active && "bg-muted font-medium text-foreground",
              item.href === "/tableau-de-bord" && "md:mt-4 md:border-t md:pt-3",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
