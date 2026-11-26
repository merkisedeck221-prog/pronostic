import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClockIcon } from "lucide-react";
import { LandingAdvantages } from "@/components/landing/advantages";
import { LandingDemo } from "@/components/landing/demo-section";
import { LandingFaq } from "@/components/landing/faq";
import { LandingFinalCta } from "@/components/landing/final-cta";
import { MobileCta } from "@/components/landing/mobile-cta";
import { LandingHero } from "@/components/landing/hero";
import { LandingHowItWorks } from "@/components/landing/how-it-works";
import { LandingMarkets } from "@/components/landing/markets";
import { LandingPerformance } from "@/components/landing/performance";
import { LandingPricing } from "@/components/landing/pricing";
import { LandingPresentation } from "@/components/landing/presentation";
import { SectionHeading } from "@/components/layout/section-heading";
import { TeamLogo } from "@/components/matches/team-logo";
import { getCurrentUser } from "@/lib/auth/session";
import { getLandingData } from "@/lib/catalog/landing";
import { getPublicFlags } from "@/lib/catalog/settings";
import { formatKickoff, resolveTimezone } from "@/lib/utils/dates";

export const metadata: Metadata = {
  title: "PRONEX — Prédisez. Analysez. Dominez.",
  description:
    "Analyses et pronostics football par PRONEX AI : probabilités, niveau de confiance et explication pour chaque match.",
};

export default async function HomePage() {
  // Un utilisateur connecté va directement à son tableau de bord.
  if (await getCurrentUser()) redirect("/tableau-de-bord");
  // Section des compteurs animés (components/landing/counters.tsx) retirée de la page
  // le 26/11/2026 à la demande du porteur, en attente de décision ; code conservé.
  const [{ markets, packs, performance, fixtures, pricing }, flags] =
    await Promise.all([getLandingData(), getPublicFlags()]);
  const timezone = resolveTimezone(null);

  return (
    <main className="flex-1">
      <LandingHero marketCount={markets.length} />
      {/* Parcours (brief, partie 17) : 1 comprendre → 2 valeur de l'IA → 3 démonstration →
          4 marchés → 5 performances réelles → 6 crédits → 7 inscription. */}
      <LandingPresentation marketCount={markets.length} />
      <LandingAdvantages marketCount={markets.length} />
      <LandingDemo marketCount={markets.length} />
      <LandingHowItWorks />
      <LandingMarkets activeCodes={markets.map((m) => m.code)} />

      {/* Aperçu des matchs : uniquement si des matchs analysés existent */}
      {fixtures.length > 0 ? (
        <section
          aria-labelledby="apercu"
          className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-16"
        >
          <SectionHeading
            id="apercu"
            eyebrow="À venir"
            title="Prochains matchs analysés"
            description="Connectez-vous pour consulter la fiche et débloquer les pronostics."
          />
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
                      <p
                        key={team.name}
                        className="flex items-center gap-2 text-sm font-medium"
                      >
                        <TeamLogo
                          name={team.name}
                          src={team.logo_url}
                          size={20}
                        />
                        <span className="truncate">{team.name}</span>
                      </p>
                    ))}
                  </div>
                  <span className="shrink-0 rounded-full bg-pronex-violet/20 px-2.5 py-1 text-xs font-semibold text-violet-200">
                    Analyse IA
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <LandingPerformance stats={performance} />
      <LandingPricing packs={packs} pricing={pricing} />

      <LandingFaq
        marketLabels={markets.map((m) => m.label)}
        pricing={pricing}
        packs={packs}
        refundOnCancel={flags.refundOnCancel}
        revealAfterMatch={flags.revealAfterMatch}
      />

      <LandingFinalCta />
      <MobileCta />
    </main>
  );
}
