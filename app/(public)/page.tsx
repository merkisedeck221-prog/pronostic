import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3Icon, CoinsIcon, LockOpenIcon, SearchIcon, SparklesIcon } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getLandingData } from "@/lib/catalog/landing";
import { formatRate } from "@/lib/settle/labels";
import { formatXof } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "PRONEX — Prédisez. Analysez. Dominez.",
  description: "Analyses et pronostics football par PRONEX AI : probabilités, niveau de confiance et explication pour chaque match.",
};

const STEPS = [
  { icon: SearchIcon, title: "Choisissez un match", text: "Parmi les compétitions suivies par PRONEX, avec forme, classement et confrontations en accès libre." },
  { icon: LockOpenIcon, title: "Débloquez l'analyse", text: "Un pronostic à l'unité ou le match complet, payé en crédits. Vous ne payez que ce qui vous intéresse." },
  { icon: BarChart3Icon, title: "Suivez les résultats", text: "Chaque pronostic est vérifié automatiquement après le match. Le taux de réussite est public." },
] as const;

const primaryCta =
  "inline-flex h-12 items-center justify-center rounded-xl bg-linear-to-r from-pronex-pink/85 to-pronex-violet px-6 font-semibold text-white shadow-[0_0_32px_-8px] shadow-pronex-pink/70 transition hover:brightness-110";
const secondaryCta =
  "inline-flex h-12 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-6 font-semibold text-white transition hover:border-white/30 hover:bg-white/10";

export default async function HomePage() {
  // Un utilisateur connecté va directement à son tableau de bord.
  if (await getCurrentUser()) redirect("/tableau-de-bord");
  const { markets, cheapestPack, performance } = await getLandingData();
  const resolved = performance ? performance.won + performance.lost : 0;

  return (
    <main className="flex-1">
      {/* Accroche */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pt-10 pb-16 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
        <div className="space-y-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-pronex-pink/30 bg-pronex-pink/10 px-3 py-1 text-xs font-semibold tracking-wide text-pronex-pink">
            <SparklesIcon className="size-3.5" aria-hidden />
            Pronostics football par PRONEX AI
          </p>
          <h1 className="text-4xl leading-tight font-extrabold tracking-tight italic sm:text-5xl">
            Prédisez.{" "}
            <span className="bg-linear-to-r from-pronex-pink/85 to-pronex-violet bg-clip-text text-transparent">Analysez.</span>
            <br />
            Dominez.
          </h1>
          <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
            Pour chaque match analysé : la sélection de l&apos;IA, sa probabilité, son niveau de confiance et une explication
            claire, construites à partir de données réelles.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/inscription" className={primaryCta}>
              Créer mon compte
            </Link>
            <Link href="/connexion" className={secondaryCta}>
              Se connecter
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">Réservé aux 18 ans et plus. Pronostics sans garantie de résultat.</p>
        </div>
        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div aria-hidden className="absolute inset-0 -z-10 rounded-full bg-pronex-violet/20 blur-3xl" />
          <Image src="/brand/pronex-logo.webp" alt="Logo PRONEX" width={720} height={432} priority className="w-full" />
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-14">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Comment ça marche</h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="space-y-3 rounded-2xl border border-white/10 bg-card p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-pronex-pink/85 to-pronex-violet text-white">
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

      {/* Types de pronostics : lus en base (actifs uniquement) */}
      {markets.length > 0 ? (
        <section className="mx-auto w-full max-w-6xl space-y-8 px-4 py-14">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {markets.length} types de pronostics par match
            </h2>
            <p className="text-muted-foreground">Débloquez-les un par un, ou tous ensemble avec le match complet.</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {markets.map((m) => (
              <li key={m.code} className="rounded-xl border border-white/10 bg-card p-4">
                <p className="font-semibold">{m.label}</p>
                {m.description ? <p className="mt-1 text-sm text-muted-foreground">{m.description}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Transparence et crédits */}
      <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 pb-16 md:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-white/10 bg-card p-6">
          <BarChart3Icon className="size-6 text-pronex-pink" aria-hidden />
          <h2 className="text-xl font-bold">Des résultats publics</h2>
          {resolved > 0 && performance ? (
            <p className="text-muted-foreground">
              Taux de réussite actuel :{" "}
              <span className="font-semibold text-foreground">{formatRate(performance.won, performance.lost)}</span> sur {resolved}{" "}
              pronostic{resolved > 1 ? "s" : ""} terminé{resolved > 1 ? "s" : ""}.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Les premiers résultats apparaîtront ici après les premiers matchs analysés. Aucun chiffre n&apos;est affiché avant
              d&apos;être réel.
            </p>
          )}
          <Link href="/performances" className="inline-block text-sm font-semibold text-pronex-pink hover:underline">
            Voir les performances
          </Link>
        </div>
        <div className="space-y-3 rounded-2xl border border-white/10 bg-card p-6">
          <CoinsIcon className="size-6 text-pronex-violet" aria-hidden />
          <h2 className="text-xl font-bold">Des crédits, sans abonnement</h2>
          <p className="text-muted-foreground">
            {cheapestPack
              ? `Packs à partir de ${formatXof(cheapestPack.price_xof)} pour ${cheapestPack.credits} crédits. Chaque pack donne exactement les crédits annoncés.`
              : "Achetez des crédits quand vous le souhaitez : chaque pack donne exactement les crédits annoncés."}{" "}
            Les crédits n&apos;expirent pas.
          </p>
          <Link href="/inscription" className="inline-block text-sm font-semibold text-pronex-pink hover:underline">
            Créer mon compte
          </Link>
        </div>
      </section>
    </main>
  );
}
