import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { withParams, type SearchParams } from "@/lib/admin/params";
import { cn } from "@/lib/utils";

/** Pagination côté serveur (liens). */
export function Pagination({ path, params, page, pageCount, total }: { path: string; params: SearchParams; page: number; pageCount: number; total: number }) {
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-2 pt-3 text-sm">
      <span className="text-muted-foreground">
        {total} résultat{total > 1 ? "s" : ""} · page {Math.min(page, pageCount)} sur {pageCount}
      </span>
      <span className="flex gap-2">
        {page > 1 ? (
          <Link href={withParams(path, params, { page: page - 1 })} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Précédent
          </Link>
        ) : null}
        {page < pageCount ? (
          <Link href={withParams(path, params, { page: page + 1 })} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Suivant
          </Link>
        ) : null}
      </span>
    </nav>
  );
}

/** En-tête de colonne triable (lien qui bascule le tri). */
export function SortLink({ path, params, current, asc, desc, children }: { path: string; params: SearchParams; current: string; asc: string; desc: string; children: ReactNode }) {
  const next = current === desc ? asc : desc;
  const arrow = current === desc ? " ↓" : current === asc ? " ↑" : "";
  return (
    <Link href={withParams(path, params, { tri: next, page: null })} className="underline-offset-4 hover:underline">
      {children}
      {arrow}
    </Link>
  );
}

/** Formulaire GET de filtres (recherche, listes déroulantes). */
export function FilterBar({ children, resetHref }: { children: ReactNode; resetHref: string }) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-2 rounded-xl border border-white/10 bg-card p-3">
      {children}
      <button type="submit" className={cn(buttonVariants({ size: "sm" }), "bg-linear-to-r from-pronex-pink to-pronex-violet text-white hover:brightness-110")}>
        Filtrer
      </button>
      <Link href={resetHref} className={buttonVariants({ variant: "ghost", size: "sm" })}>
        Réinitialiser
      </Link>
    </form>
  );
}

export function FilterSelect({ name, label, value, options }: { name: string; label: string; value: string; options: readonly { value: string; label: string }[] }) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <select name={name} defaultValue={value} className={inputClass}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterInput({ name, label, value, placeholder, className }: { name: string; label: string; value: string; placeholder?: string; className?: string }) {
  return (
    <label className={cn("grid gap-1 text-xs text-muted-foreground", className)}>
      {label}
      <input name={name} defaultValue={value} placeholder={placeholder} className={inputClass} />
    </label>
  );
}

/** Champ de formulaire simple (actions). */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

export const inputClass =
  "h-9 rounded-lg border border-white/15 bg-pronex-night px-2.5 text-sm text-foreground outline-none transition focus-visible:border-pronex-pink/60 focus-visible:ring-2 focus-visible:ring-pronex-pink/25";

const STAT_TONES = {
  default: "border-white/10 bg-card",
  pink: "border-pronex-pink/30 bg-linear-to-br from-pronex-pink/15 to-card",
  violet: "border-pronex-violet/30 bg-linear-to-br from-pronex-violet/15 to-card",
  warning: "border-amber-400/40 bg-amber-400/10",
} as const;

/** Tuile chiffrée (vue d'ensemble, fiches). `tone` : mise en avant néon ou alerte. */
export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: keyof typeof STAT_TONES;
}) {
  return (
    <div className={cn("min-w-0 space-y-1 rounded-xl border p-4 [overflow-wrap:anywhere]", STAT_TONES[tone])}>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon ? <Icon className={cn("size-3.5", tone === "violet" ? "text-pronex-violet" : tone === "warning" ? "text-amber-300" : "text-pronex-pink")} aria-hidden /> : null}
        {label}
      </p>
      <p className="font-heading text-2xl font-bold tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Page d'administration : titre avec trait néon, description, actions à droite. */
export function AdminPage({ title, description, children, actions }: { title: string; description?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="min-w-0 flex-1 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          <div aria-hidden className="h-1 w-12 rounded-full bg-linear-to-r from-pronex-pink to-pronex-violet" />
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}
