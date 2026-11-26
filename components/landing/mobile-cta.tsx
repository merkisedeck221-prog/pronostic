"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Barre d'inscription mobile (brief, partie 17) : apparaît une fois le haut de
 * page dépassé, disparaît quand l'appel à l'action final ou le pied de page est
 * visible (pas de doublon). Mobile uniquement ; aucun message fictif (pas de
 * « X personnes viennent de… »), seulement des faits : gratuit, sans abonnement.
 */
export function MobileCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const hero = document.getElementById("hero-title")?.closest("section");
      const end =
        document.querySelector('[aria-labelledby="cta-titre"]') ??
        document.querySelector("footer");
      const pastHero = hero
        ? hero.getBoundingClientRect().bottom < 0
        : window.scrollY > 600;
      const endInView = end
        ? end.getBoundingClientRect().top < window.innerHeight
        : false;
      setVisible(pastHero && !endInView);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-pronex-night/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md transition-transform duration-300 md:hidden",
        visible ? "translate-y-0" : "pointer-events-none translate-y-full",
      )}
    >
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 text-xs leading-snug text-muted-foreground">
          <span className="block font-semibold text-foreground">
            Inscription gratuite
          </span>
          Paiement à l&apos;unité, sans abonnement
        </p>
        <Link
          href="/inscription"
          tabIndex={visible ? 0 : -1}
          className={cn(
            buttonVariants({ variant: "hero" }),
            "h-11 shrink-0 px-5",
          )}
        >
          Créer mon compte
          <ArrowRightIcon aria-hidden />
        </Link>
      </div>
    </div>
  );
}
