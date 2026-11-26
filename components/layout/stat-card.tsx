import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Chiffre clé (espace utilisateur) : libellé, grand chiffre à largeur fixe, précision facultative. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "success" | "danger" | "violet";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1 rounded-2xl border border-white/8 bg-card p-4", className)}>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon ? <Icon className="size-3.5 text-pronex-pink" aria-hidden /> : null}
        {label}
      </p>
      <p
        className={cn(
          "font-heading text-2xl font-extrabold tabular-nums sm:text-3xl",
          tone === "success" && "text-success",
          tone === "danger" && "text-red-400",
          tone === "violet" && "text-violet-200",
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
