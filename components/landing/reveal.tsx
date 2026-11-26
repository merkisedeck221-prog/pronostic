"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Apparition discrète au défilement (fondu + léger glissement), une seule fois.
 * Le contenu est visible sans JavaScript ; l'état masqué n'est posé que si
 * l'élément est encore sous l'écran, et levé dès que le défilement l'atteint
 * (y compris par un saut d'ancre). Coupé par « réduire les animations ».
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  /** « li » pour une carte de liste (ul / ol). */
  as?: "div" | "li";
}) {
  const ref = useRef<HTMLDivElement & HTMLLIElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const reached = () =>
      element.getBoundingClientRect().top < window.innerHeight * 0.9;
    if (reached()) return;
    element.dataset.reveal = "hidden";
    // Le haut de l'élément a passé le bas de l'écran (défilement ou saut par une ancre) : on affiche.
    let frame = 0;
    const check = () => {
      frame = 0;
      if (!reached()) return;
      element.dataset.reveal = "shown";
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <Tag
      ref={ref}
      className={cn("pronex-reveal", className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}
