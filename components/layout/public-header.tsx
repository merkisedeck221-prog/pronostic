"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { MenuIcon, XIcon } from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Sections de la landing (ancres valables depuis toutes les pages publiques). */
const NAV = [
  { href: "/", label: "Accueil" },
  { href: "/#fonctionnement", label: "Fonctionnement" },
  { href: "/#analyses", label: "Analyses IA" },
  { href: "/#performances", label: "Performances" },
  { href: "/#tarifs", label: "Tarifs" },
  { href: "/#faq", label: "FAQ" },
] as const;

/**
 * En-tête des pages publiques : logo à gauche, navigation au centre, accès au
 * compte à droite. Sur mobile, menu compact (panneau sous l'en-tête).
 */
export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-pronex-night/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4">
        <Brand href="/" compact />

        <nav aria-label="Navigation principale" className="hidden lg:block">
          <ul className="flex items-center gap-1 text-sm">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/connexion" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}>
            Se connecter
          </Link>
          <Link href="/inscription" className={buttonVariants({ size: "sm" })}>
            Commencer<span className="hidden sm:inline">&nbsp;gratuitement</span>
          </Link>
          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-xl border border-white/10 text-foreground lg:hidden"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <XIcon className="size-5" aria-hidden /> : <MenuIcon className="size-5" aria-hidden />}
          </button>
        </div>
      </div>

      <div id={panelId} hidden={!open} className="border-t border-white/10 bg-pronex-night/95 lg:hidden">
        <nav aria-label="Navigation principale (mobile)" className="mx-auto w-full max-w-6xl px-4 py-3">
          <ul className="grid grid-cols-2 gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/connexion"
            onClick={() => setOpen(false)}
            className={cn(buttonVariants({ variant: "outline" }), "mt-3 w-full sm:hidden")}
          >
            Se connecter
          </Link>
        </nav>
      </div>
    </header>
  );
}
