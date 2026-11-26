"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const DURATION_MS = 3200;

/** Départ en douceur, accélération, puis ralentissement élégant (ease-in-out cubique). */
export function easeInOutCubic(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Valeur affichée à l'instant t (0 → 1) ; arrondie à l'entier, jamais au-delà de la cible. */
export function countAt(target: number, t: number): number {
  return Math.min(target, Math.round(target * easeInOutCubic(Math.max(0, Math.min(1, t)))));
}

const FORMAT = new Intl.NumberFormat("fr-FR");

/**
 * Compteur animé « Count Up » : part de zéro quand il entre dans le champ de
 * vision, une seule fois. Le rendu serveur affiche directement la valeur finale
 * (lisible sans JavaScript, référencement) ; avec « réduire les animations »,
 * la valeur finale reste affichée sans animation.
 */
export function CountUp({ value, prefix = "", className }: { value: number; prefix?: string; className?: string }) {
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
        // Chiffres en dégradé rose → violet avec halo néon (inspiré de la vidéo de référence).
        "inline-block bg-linear-to-b from-pronex-pink to-pronex-violet bg-clip-text pr-[0.06em] text-transparent tabular-nums",
        "transition-[filter,transform] duration-700 ease-out",
        phase === "running"
          ? "[filter:drop-shadow(0_0_14px_rgb(255_20_147_/_0.65))_drop-shadow(0_0_32px_rgb(160_0_255_/_0.45))]"
          : "[filter:drop-shadow(0_0_10px_rgb(255_20_147_/_0.4))_drop-shadow(0_0_24px_rgb(160_0_255_/_0.3))]",
        phase === "done" && "pronex-settle",
        className,
      )}
    >
      {prefix}
      {FORMAT.format(display)}
    </span>
  );
}
