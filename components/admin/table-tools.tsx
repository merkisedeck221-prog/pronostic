import Link from "next/link";
import type { ReactNode } from "react";
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
    <form method="get" className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
      {children}
      <button type="submit" className={buttonVariants({ size: "sm" })}>
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
      <select name={name} defaultValue={value} className="h-8 rounded-md border bg-background px-2 text-sm text-foreground">
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
      <input name={name} defaultValue={value} placeholder={placeholder} className="h-8 rounded-md border bg-background px-2 text-sm text-foreground" />
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

export const inputClass = "h-8 rounded-md border bg-background px-2 text-sm text-foreground";

/** Tuile chiffrée de la vue d'ensemble. */
export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function AdminPage({ title, description, children, actions }: { title: string; description?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="min-w-0 flex-1 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}
