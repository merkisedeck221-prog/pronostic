"use client";

import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "lucide-react";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Bouton de thème : sombre PRONEX (par défaut) ⇄ clair noir et blanc.
 * Le choix est mémorisé sur l'appareil (localStorage « pronex-theme ») et
 * appliqué avant l'affichage par THEME_SCRIPT (lib/theme.ts, aucun flash).
 */
type Theme = "dark" | "light";

const listeners = new Set<() => void>();

function readTheme(): Theme {
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // stockage indisponible (navigation privée) : le thème vaut pour la page
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore<Theme>(subscribe, readTheme, () => "dark");
  const next: Theme = theme === "light" ? "dark" : "light";
  const label = next === "light" ? "Passer au thème clair (noir et blanc)" : "Passer au thème sombre PRONEX";

  return (
    <button
      type="button"
      onClick={() => applyTheme(next)}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 text-foreground transition-colors hover:bg-white/5",
        className,
      )}
    >
      {theme === "light" ? <MoonIcon className="size-5" aria-hidden /> : <SunIcon className="size-5" aria-hidden />}
    </button>
  );
}
