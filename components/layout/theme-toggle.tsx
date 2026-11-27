"use client";

import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "lucide-react";
import { DARK_CLASS, THEME_STORAGE_KEY } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** Bouton soleil / lune : thème clair ⇄ sombre « Carbone » (voir lib/theme.ts). */
type Theme = "light" | "dark";
const listeners = new Set<() => void>();

function readTheme(): Theme {
  return document.documentElement.classList.contains(DARK_CLASS) ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle(DARK_CLASS, theme === "dark");
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // stockage indisponible : le thème vaut pour la page
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore<Theme>(subscribe, readTheme, () => "light");
  const next: Theme = theme === "dark" ? "light" : "dark";
  const label = next === "dark" ? "Passer au thème sombre" : "Passer au thème clair";
  return (
    <button
      type="button"
      onClick={() => applyTheme(next)}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-[#fff]/80 transition-colors hover:bg-[#fff]/10 hover:text-[#fff] pointer-coarse:size-11",
        className,
      )}
    >
      {theme === "dark" ? <SunIcon className="size-5" aria-hidden /> : <MoonIcon className="size-5" aria-hidden />}
    </button>
  );
}
