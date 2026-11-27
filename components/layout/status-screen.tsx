import Image from "next/image";
import type { ReactNode } from "react";

/** Écran plein (404, erreur) : logo PRONEX, grand code en dégradé néon, message et actions. */
export function StatusScreen({ code, title, children, actions }: { code: string; title: string; children: ReactNode; actions: ReactNode }) {
  return (
    <main id="contenu" className="relative mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-5 px-4 py-16 text-center">
      <div aria-hidden className="absolute inset-x-0 top-1/4 -z-10 mx-auto h-56 w-56 rounded-full bg-pronex-violet/20 blur-3xl" />
      <Image src="/brand/pronex-icon.webp" alt="" width={72} height={72} className="size-16 drop-shadow-[0_0_18px_rgb(255_20_147/0.45)]" />
      <p className="bg-linear-to-r from-pronex-pink to-pronex-violet bg-clip-text font-heading text-7xl font-extrabold tracking-tight text-transparent italic">
        {code}
      </p>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
      <div className="flex flex-wrap justify-center gap-3">{actions}</div>
    </main>
  );
}

export const statusPrimaryCta =
  "inline-flex h-11 items-center justify-center rounded-xl bg-linear-to-r from-pronex-pink/85 to-pronex-violet px-5 text-sm font-semibold text-on-accent shadow-[0_0_28px_-8px] shadow-pronex-pink/70 transition hover:brightness-110";
export const statusSecondaryCta =
  "inline-flex h-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10";
