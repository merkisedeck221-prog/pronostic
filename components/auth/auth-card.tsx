import type { ReactNode } from "react";
import Image from "next/image";
import { BarChart3Icon, ShieldCheckIcon, SparklesIcon } from "lucide-react";
import { PronexMark } from "@/components/layout/pronex-mark";

const POINTS = [
  { icon: SparklesIcon, text: "Analyses rédigées par PRONEX AI à partir de données réelles" },
  { icon: ShieldCheckIcon, text: "Vous ne payez que les pronostics que vous débloquez" },
  { icon: BarChart3Icon, text: "Résultats vérifiés automatiquement après chaque match" },
] as const;

/**
 * Pages d'authentification, dans le style de la landing : grande carte photo
 * bleu nuit (logo, slogan, 3 engagements) et carte blanche du formulaire.
 * Couleurs du panneau photo en hexadécimal (texte clair sur photo sombre).
 */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="mx-auto grid w-full max-w-[1140px] flex-1 items-stretch gap-5 px-4 py-8 lg:grid-cols-[1.05fr_1fr] lg:py-10">
      <section aria-hidden className="relative hidden min-h-[620px] overflow-hidden rounded-[20px] bg-[#042644] text-[#fff] lg:block">
        <Image src="/landing/v2/hero.webp" alt="" fill sizes="560px" className="object-cover object-[70%_30%]" priority />
        <div className="absolute inset-0 bg-linear-to-b from-[#042644]/30 via-[#042644]/45 to-[#042644]/95" />
        <div className="relative flex h-full flex-col justify-between p-8">
          <div className="flex items-center gap-2.5">
            <PronexMark body="#fff" ball="#c9f13e" accent="#fff" className="h-8 w-auto" />
            <span className="text-2xl font-semibold tracking-[-0.04em]">PRONEX</span>
          </div>
          <div className="space-y-6">
            <p className="text-[15px] tracking-[0.02em] text-[#fff]/80">Prédisez. Analysez. Dominez.</p>
            <p className="max-w-md text-[40px] leading-[1.08] font-normal tracking-[-0.045em]">
              Le football analysé par l&apos;intelligence artificielle.
            </p>
            <ul className="space-y-3">
              {POINTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-[15px] text-[#fff]/90">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#c9f13e] text-[#000]">
                    <Icon className="size-4" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="flex items-center">
        <div className="w-full space-y-6 rounded-[20px] border border-border bg-card p-6 shadow-[0_18px_40px_-30px_rgb(4_38_68/0.35)] sm:p-10">
          <div className="flex items-center gap-2 lg:hidden">
            <PronexMark ball="#c9f13e" className="h-7 w-auto" />
            <span className="text-xl font-semibold tracking-[-0.04em]">PRONEX</span>
          </div>
          <div className="space-y-2">
            <span className="inline-flex h-8 items-center gap-2 rounded-full border border-border px-3.5 text-sm">
              <span className="size-1 rounded-full bg-foreground" aria-hidden />
              Espace membre
            </span>
            <h1 className="text-[40px] leading-[1.05] font-normal tracking-[-0.045em]">{title}</h1>
            {description ? <div className="text-[15px] text-muted-foreground">{description}</div> : null}
          </div>
          {children}
          {footer ? <div className="space-y-2 border-t border-border pt-5 text-[15px]">{footer}</div> : null}
        </div>
      </div>
    </main>
  );
}
