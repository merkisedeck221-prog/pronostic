import type { ReactNode } from "react";
import Image from "next/image";
import { BarChart3Icon, ShieldCheckIcon, SparklesIcon } from "lucide-react";

const POINTS = [
  { icon: SparklesIcon, text: "Analyses rédigées par PRONEX AI à partir de données réelles" },
  { icon: ShieldCheckIcon, text: "Vous ne payez que les pronostics que vous débloquez" },
  { icon: BarChart3Icon, text: "Résultats vérifiés automatiquement après chaque match" },
] as const;

/**
 * Mise en page des pages d'authentification : panneau PRONEX (ordinateur)
 * et carte du formulaire.
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
    <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-4 py-10 lg:grid-cols-2">
      <section aria-hidden className="hidden space-y-8 lg:block">
        <Image src="/brand/pronex-logo.webp" alt="" width={720} height={432} className="w-full max-w-md" />
        <ul className="space-y-4">
          {POINTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-pronex-pink">
                <Icon className="size-4" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </section>

      <div className="mx-auto w-full max-w-md">
        <div className="rounded-2xl bg-linear-to-br from-pronex-pink/50 via-white/10 to-pronex-violet/50 p-px shadow-[0_0_60px_-20px] shadow-pronex-pink/50">
          <div className="space-y-6 rounded-2xl bg-card p-6 sm:p-8">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
            </div>
            {children}
            {footer ? <div className="space-y-2 border-t border-white/10 pt-4 text-sm">{footer}</div> : null}
          </div>
        </div>
      </div>
    </main>
  );
}
