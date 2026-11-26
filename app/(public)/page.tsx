import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3Icon,
  CalendarClockIcon,
  CoinsIcon,
  LockOpenIcon,
  SearchIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  TagIcon,
} from "lucide-react";
import { DEMO_COUNTERS, LandingCounters } from "@/components/landing/counters";
import { LandingHero } from "@/components/landing/hero";
import { LandingPresentation } from "@/components/landing/presentation";
import { SectionHeading } from "@/components/layout/section-heading";
import { TeamLogo } from "@/components/matches/team-logo";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { getPublicCounters } from "@/lib/catalog/counters";
import { getLandingData } from "@/lib/catalog/landing";
import { getPublicFlags } from "@/lib/catalog/settings";
import { formatRate } from "@/lib/settle/labels";
import { cn } from "@/lib/utils";
import { formatKickoff, resolveTimezone } from "@/lib/utils/dates";
import { formatXof } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "PRONEX — Prédisez. Analysez. Dominez.",
  description: "Analyses et pronostics football par PRONEX AI : probabilités, niveau de confiance et explication pour chaque match.",
};

const ADVANTAGES = [
  { icon: CoinsIcon, title: "Vous payez à l'unité", text: "Un pronostic ou le match complet : vous débloquez seulement ce qui vous intéresse. Aucun abonnement." },
  { icon: BarChart3Icon, title: "Transparence totale", text: "Le taux de réussite est public et calculé sur tous les pronostics terminés, y compris les perdus." },
  { icon: TagIcon, title: "Prix connu à l'avance", text: "Le prix en crédits est affiché avant chaque déblocage, avec votre solde avant et après." },
  { icon: SmartphoneIcon, title: "Pensé pour le mobile", text: "Une interface rapide et lisible, conçue d'abord pour le téléphone." },
] as const;

const STEPS = [
  { icon: SearchIcon, title: "Choisissez un match", text: "Forme, classement et confrontations sont en accès libre sur chaque fiche match." },
  { icon: LockOpenIcon, title: "Débloquez l'analyse", text: "Un pronostic à l'unité ou le match complet, payé avec vos crédits." },
  { icon: BarChart3Icon, title: "Suivez les résultats", text: "Vos pronostics sont vérifiés après le match et rassemblés dans votre historique." },
] as const;

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

export default async function HomePage({ searchParams }: PageProps<"/">) {
  // Un utilisateur connecté va directement à son tableau de bord.
  if (await getCurrentUser()) redirect("/tableau-de-bord");
  const [{ markets, packs, performance, fixtures }, flags, realCounters] = await Promise.all([
    getLandingData(),
    getPublicFlags(),
    getPublicCounters(),
  ]);
  // Aperçu de l'animation pendant le développement : valeurs d'exemple, signalées « Démonstration ».
  const demoCounters = (await searchParams).apercu === "compteurs";
  const timezone = resolveTimezone(null);
  const resolved = performance ? performance.global.won + performance.global.lost : 0;
  const resolved30 = performance ? performance.last30.won + performance.last30.lost : 0;

  return (
    <main className="flex-1">
      <LandingHero marketCount={markets.length} />
      <LandingCounters counters={demoCounters ? DEMO_COUNTERS : realCounters} demo={demoCounters} />
      <LandingPresentation marketCount={markets.length} />

      {/* Avantages */}
      <section aria-labelledby="avantages" className="mx-auto w-full max-w-6xl space-y-8 px-4 py-14">
        <SectionHeading id="avantages" eyebrow="Pourquoi PRONEX" title="Les avantages de la plateforme" />
        <ul className="pronex-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ADVANTAGES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="pronex-lift space-y-2 rounded-2xl border border-white/8 bg-card p-5">
              <Icon className="size-5 text-pronex-pink" aria-hidden />
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Types d'analyses (lus en base) */}
      {markets.length > 0 ? (
        <section id="analyses" aria-labelledby="analyses-titre" className="mx-auto w-full max-w-6xl scroll-mt-20 space-y-8 px-4 pb-14">
          <SectionHeading
            id="analyses-titre"
            eyebrow="Analyses"
            title={`${markets.length} types de pronostics par match`}
            description="Débloquez-les un par un, ou tous ensemble avec le match complet."
          />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {markets.map((m) => (
              <li key={m.code} className="rounded-xl border border-white/8 bg-card p-4">
                <p className="font-semibold">{m.label}</p>
                {m.description ? <p className="mt-1 text-sm text-muted-foreground">{m.description}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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

      {/* Performances réelles + crédits */}
      <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 pb-14 lg:grid-cols-2">
        <div id="performances" aria-labelledby="perfs" className="scroll-mt-20 space-y-4 rounded-2xl border border-white/8 bg-card p-6">
          <p className="text-xs font-semibold tracking-[0.2em] text-pronex-pink uppercase">Performances</p>
          <h2 id="perfs" className="text-xl font-bold">
            Des résultats publics
          </h2>
          {resolved > 0 && performance ? (
            <dl className="grid grid-cols-3 gap-3">
              <div>
                <dt className="text-xs text-muted-foreground">Réussite globale</dt>
                <dd className="font-heading text-2xl font-extrabold tabular-nums">{formatRate(performance.global.won, performance.global.lost)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Gagnés</dt>
                <dd className="font-heading text-2xl font-extrabold text-success tabular-nums">{performance.global.won}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Perdus</dt>
                <dd className="font-heading text-2xl font-extrabold text-red-400 tabular-nums">{performance.global.lost}</dd>
              </div>
              {resolved30 > 0 ? (
                <div className="col-span-3 text-sm text-muted-foreground">
                  30 derniers jours : {formatRate(performance.last30.won, performance.last30.lost)} sur {resolved30} pronostic
                  {resolved30 > 1 ? "s" : ""} terminé{resolved30 > 1 ? "s" : ""}.
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="text-muted-foreground">
              Les premiers résultats apparaîtront ici après les premiers matchs analysés. Aucun chiffre n&apos;est affiché avant
              d&apos;être réel.
            </p>
          )}
          <Link href="/performances" className="inline-block text-sm font-semibold text-pronex-pink hover:underline">
            Voir le détail des performances
          </Link>
        </div>

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

      {/* Comment ça marche */}
      <section id="fonctionnement" aria-labelledby="etapes" className="scroll-mt-16 border-y border-white/5 bg-white/[0.02]">
        <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-14">
          <SectionHeading id="etapes" eyebrow="Fonctionnement" title="Comment ça marche" />
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="space-y-3 rounded-2xl border border-white/8 bg-card p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-pronex-pink/15 text-pronex-pink">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="font-heading text-sm font-bold text-muted-foreground">0{i + 1}</span>
                </div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
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
