import type { ReactNode } from "react";

/** Mise en forme simple des pages de texte (CGU, jeu responsable). */
export function LegalPage({ title, updatedAt, children }: { title: string; updatedAt: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      <div aria-hidden className="mt-2 h-1 w-12 rounded-full bg-linear-to-r from-pronex-pink to-pronex-violet" />
      <p className="mt-1 text-sm text-muted-foreground">
        Version provisoire — mise à jour le {updatedAt}. Ce texte sera complété avant le lancement commercial.
      </p>
      <div className="mt-8 space-y-6 rounded-2xl border border-white/10 bg-card p-6 text-sm leading-relaxed sm:p-8 [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_section]:space-y-2">
        {children}
      </div>
    </main>
  );
}
