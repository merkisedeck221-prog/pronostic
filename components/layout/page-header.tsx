import type { ReactNode } from "react";

/** En-tête de page PRONEX : titre, trait néon, description facultative. */
export function PageHeader({ title, description, children }: { title: ReactNode; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      <div aria-hidden className="h-1 w-12 rounded-full bg-[#c9f13e]" />
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      {children}
    </div>
  );
}
