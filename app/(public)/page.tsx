import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarClockIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { LandingAdvantages } from "@/components/landing/advantages";
import { LandingDemo } from "@/components/landing/demo-section";
import { LandingHero } from "@/components/landing/hero";
import { LandingHowItWorks } from "@/components/landing/how-it-works";
import { LandingMarkets } from "@/components/landing/markets";
import { LandingPerformance } from "@/components/landing/performance";
import { LandingPresentation } from "@/components/landing/presentation";
import { SectionHeading } from "@/components/layout/section-heading";
import { TeamLogo } from "@/components/matches/team-logo";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { getLandingData } from "@/lib/catalog/landing";
import { getPublicFlags } from "@/lib/catalog/settings";
import { cn } from "@/lib/utils";
import { formatKickoff, resolveTimezone } from "@/lib/utils/dates";
import { formatXof } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "PRONEX — Prédisez. Analysez. Dominez.",
  description: "Analyses et pronostics football par PRONEX AI : probabilités, niveau de confiance et explication pour chaque match.",
};

function faqItems({ refundOnCancel, revealAfterMatch }: { refundOnCancel: boolean; revealAfterMatch: boolean }) {
  return [
    {
      q: "Qu'est-ce que PRONEX ?",
      a: "PRONEX est une plateforme d'analyses et de pronostics football générés par intelligence artificielle (PRONEX AI). Chaque analyse s'appuie sur des données réelles et indique une probabilité, un niveau de confiance et une explication.",
    },
    {
      q: "Les pronostics sont-ils garantis ?",
      a: "Non. Un pronostic est une estimation : il peut être perdu. PRONEX publie son taux de réussite réel, pronostics perdus compris, pour que vous puissiez juger par vous-même.",
    },
    {
      q: "Comment fonctionnent les crédits ?",
      a: "Vous achetez un pack de crédits, puis vous dépensez ces crédits pour débloquer des pronostics. Chaque pack donne exactement les crédits annoncés, le prix d'un déblocage est affiché avant confirmation, et les crédits n'expirent pas. Ils ne sont ni remboursables en argent ni convertibles.",
    },
    {
      q: "Quand mes crédits sont-ils ajoutés ?",
      a: "Uniquement après la confirmation du paiement par le prestataire. Un reçu est disponible pour chaque achat réussi.",
    },
    {
      q: "Que se passe-t-il si un match est annulé ?",
      a: refundOnCancel
        ? "Si un match est annulé ou reporté de plus de 48 heures, les crédits dépensés sur ce match vous sont rendus automatiquement."
        : "Les cas d'annulation sont traités selon les conditions générales d'utilisation.",
    },
    {
      q: "Comment est calculé le taux de réussite ?",
      a: "Gagnés ÷ (gagnés + perdus), sur tous les pronostics publiés et terminés. Les pronostics annulés (par exemple un match interrompu) ne comptent ni comme gagnés ni comme perdus.",
    },
    ...(revealAfterMatch
      ? [{ q: "Puis-je voir un pronostic après le match ?", a: "Oui : une fois le match terminé, ses pronostics deviennent visibles par tous, sans crédit." }]
      : []),
    { q: "Qui peut s'inscrire ?", a: "PRONEX est réservé aux personnes âgées de 18 ans ou plus. L'âge est déclaré à l'inscription." },
  ];
}

export default async function HomePage() {
  // Un utilisateur connecté va directement à son tableau de bord.
  if (await getCurrentUser()) redirect("/tableau-de-bord");
  // Section des compteurs animés (components/landing/counters.tsx) retirée de la page
  // le 26/11/2026 à la demande du porteur, en attente de décision ; code conservé.
  const [{ markets, packs, performance, fixtures }, flags] = await Promise.all([getLandingData(), getPublicFlags()]);
  const timezone = resolveTimezone(null);

  return (
    <main className="flex-1">
      <LandingHero marketCount={markets.length} />
      <LandingPresentation marketCount={markets.length} />
      <LandingDemo marketCount={markets.length} />
      <LandingHowItWorks />

      <LandingMarkets activeCodes={markets.map((m) => m.code)} />
      <LandingPerformance stats={performance} />
      <LandingAdvantages marketCount={markets.length} />

      {/* Aperçu des matchs : uniquement si des matchs analysés existent */}
      {fixtures.length > 0 ? (
        <section aria-labelledby="apercu" className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-14">
          <SectionHeading id="apercu" eyebrow="À venir" title="Prochains matchs analysés" description="Connectez-vous pour consulter la fiche et débloquer les pronostics." />
          <ul className="grid gap-3 sm:grid-cols-2">
            {fixtures.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/connexion?next=${encodeURIComponent(`/matchs/${f.id}`)}`}
                  className="pronex-lift flex items-center gap-4 rounded-2xl border border-white/8 bg-card p-4"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarClockIcon className="size-3.5" aria-hidden />
                      {formatKickoff(f.kickoff_at, timezone)} · {f.competition}
                    </p>
                    {[f.home, f.away].map((team) => (
                      <p key={team.name} className="flex items-center gap-2 text-sm font-medium">
                        <TeamLogo name={team.name} src={team.logo_url} size={20} />
                        <span className="truncate">{team.name}</span>
                      </p>
                    ))}
                  </div>
                  <span className="shrink-0 rounded-full bg-pronex-violet/20 px-2.5 py-1 text-xs font-semibold text-violet-200">Analyse IA</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Crédits (refonte à venir dans la partie « Tarifs » du brief) */}
      <section className="mx-auto grid w-full max-w-3xl gap-4 px-4 py-14">
        <div id="tarifs" aria-labelledby="credits" className="scroll-mt-20 space-y-4 rounded-2xl border border-white/8 bg-card p-6">
          <p className="text-xs font-semibold tracking-[0.2em] text-pronex-pink uppercase">Crédits</p>
          <h2 id="credits" className="text-xl font-bold">
            Des crédits, sans abonnement
          </h2>
          <p className="text-sm text-muted-foreground">
            Chaque pack donne exactement les crédits annoncés. Le prix de chaque déblocage est affiché avant confirmation. Les
            crédits n&apos;expirent pas.
          </p>
          {packs.length > 0 ? (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {packs.map((pack) => (
                <li
                  key={pack.id}
                  className={cn(
                    "rounded-xl border p-3",
                    pack.is_featured ? "border-pronex-pink/50 bg-pronex-pink/5" : "border-white/8 bg-white/[0.02]",
                  )}
                >
                  <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{pack.name}</p>
                  <p className="font-heading text-lg font-bold tabular-nums">{pack.credits} crédits</p>
                  <p className="text-xs text-muted-foreground tabular-nums">{formatXof(pack.price_xof)}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" aria-labelledby="faq-titre" className="mx-auto w-full max-w-3xl scroll-mt-16 space-y-6 px-4 py-14">
        <SectionHeading id="faq-titre" eyebrow="FAQ" title="Questions fréquentes" align="center" />
        <div className="divide-y divide-white/8 rounded-2xl border border-white/8 bg-card">
          {faqItems(flags).map(({ q, a }) => (
            <details key={q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                {q}
                <span aria-hidden className="text-xl leading-none text-pronex-pink transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="pt-3 text-sm leading-relaxed text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Appel à l'action final */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-16">
        <div className="flex flex-col items-start gap-6 rounded-3xl border border-pronex-violet/30 bg-card p-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Prêt à analyser votre prochain match ?</h2>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheckIcon className="size-4 text-success" aria-hidden />
              Inscription gratuite · réservée aux 18 ans et plus
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/inscription" className={buttonVariants({ variant: "hero", size: "lg" })}>
              Créer mon compte
            </Link>
            <Link href="/connexion" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Se connecter
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
