"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { MenuIcon, XIcon } from "lucide-react";
import { PronexMark } from "@/components/layout/pronex-mark";

/** Sections de la landing (ancres valables depuis toutes les pages publiques). */
const NAV = [
  { href: "/#fonctionnement", label: "Fonctionnement" },
  { href: "/#pronostics", label: "Pronostics" },
  { href: "/#tarifs", label: "Tarifs" },
  { href: "/#faq", label: "FAQ" },
  { href: "/performances", label: "Performances" },
] as const;

/**
 * En-tête des pages publiques, dans le style de la landing : barre en pilule
 * bleu nuit (logo, navigation, accès au compte). Sur mobile, menu compact.
 * Couleurs en hexadécimal : la zone `.pxa` inverse `white` (texte sombre).
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
    <header className="sticky top-0 z-40 px-4 pt-4">
      <div className="mx-auto w-full max-w-[1140px] rounded-[30px] bg-[#042644]/95 text-[#fff] shadow-[0_18px_40px_-24px_rgb(4_38_68/0.7)] backdrop-blur-md">
        <div className="flex h-[58px] items-center justify-between gap-3 pr-2 pl-5">
          <Link href="/" className="flex min-h-11 items-center gap-2.5" aria-label="PRONEX, accueil">
            <PronexMark body="#fff" ball="#c9f13e" accent="#fff" className="h-7 w-auto" />
            <span className="text-[22px] font-semibold tracking-[-0.04em]">PRONEX</span>
          </Link>

          <nav aria-label="Navigation principale" className="hidden lg:block">
            <ul className="flex items-center gap-6 text-[17px] tracking-[-0.02em]">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="tap-target text-[#fff]/90 transition-opacity hover:opacity-70">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-1.5">
            <Link href="/connexion" className="hidden h-[42px] items-center rounded-full px-4 text-[15px] text-[#fff] transition-colors hover:bg-[#fff]/10 sm:flex">
              Connexion
            </Link>
            <Link
              href="/inscription"
              className="flex h-[42px] items-center rounded-full bg-[#fff] px-4 text-[15px] font-medium text-[#000] transition-colors hover:bg-[#c9f13e] sm:px-5"
            >
              <span className="sm:hidden">S&apos;inscrire</span>
              <span className="hidden sm:inline">Créer mon compte</span>
            </Link>
            <button
              type="button"
              className="flex size-11 items-center justify-center rounded-full text-[#fff] hover:bg-[#fff]/10 lg:hidden"
              aria-expanded={open}
              aria-controls={panelId}
              aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <XIcon className="size-5" aria-hidden /> : <MenuIcon className="size-5" aria-hidden />}
            </button>
          </div>
        </div>

        <div id={panelId} hidden={!open} className="border-t border-[#fff]/10 lg:hidden">
          <nav aria-label="Navigation principale (mobile)" className="px-4 py-3">
            <ul className="grid grid-cols-2 gap-1">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 items-center rounded-2xl px-3 text-[15px] text-[#fff]/90 hover:bg-[#fff]/10"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/connexion"
              onClick={() => setOpen(false)}
              className="mt-3 flex h-11 w-full items-center justify-center rounded-full border border-[#fff]/30 text-[15px] text-[#fff] sm:hidden"
            >
              Connexion
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
