"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const DURATION_MS = 2200;

/** Accélération puis ralentissement doux (ease-out exponentiel). */
export function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/** Valeur affichée à l'instant t (0 → 1) ; arrondie à l'entier, jamais au-delà de la cible. */
export function countAt(target: number, t: number): number {
  return Math.min(target, Math.round(target * easeOutExpo(Math.max(0, Math.min(1, t)))));
}

const FORMAT = new Intl.NumberFormat("fr-FR");

/**
 * Compteur animé « Count Up » : part de zéro quand il entre dans le champ de
 * vision, une seule fois. Le rendu serveur affiche directement la valeur finale
 * (lisible sans JavaScript, référencement) ; avec « réduire les animations »,
 * la valeur finale reste affichée sans animation.
 */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;

    let started = false;
    // Repart de zéro avant d'être visible (au prochain rafraîchissement, hors rendu).
    let frame = requestAnimationFrame(() => {
      if (!started) setDisplay(0);
    });
    const start = () => {
      started = true;
      setPhase("running");
      const t0 = performance.now();
      const tick = (now: number) => {
        const t = (now - t0) / DURATION_MS;
        setDisplay(countAt(value, t));
        if (t < 1) frame = requestAnimationFrame(tick);
        else setPhase("done");
      };
      frame = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (!started && entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          start();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return (
    <span
      ref={ref}
      className={cn(
        "tabular-nums transition-[text-shadow] duration-700",
        phase === "running" && "[text-shadow:0_0_28px_rgb(255_20_147_/_0.45)]",
        phase !== "running" && "[text-shadow:0_0_22px_rgb(160_0_255_/_0.35)]",
        className,
      )}
    >
      {FORMAT.format(display)}
    </span>
  );
}
