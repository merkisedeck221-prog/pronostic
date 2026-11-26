"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BrainCircuitIcon, CheckIcon, LoaderCircleIcon, LockIcon, PlayIcon, RotateCcwIcon, SparklesIcon } from "lucide-react";
import { FormBadges } from "@/components/matches/form-badges";
import { buttonVariants } from "@/components/ui/button";
import { VISUAL_STEPS } from "@/lib/generation/stages";
import { cn } from "@/lib/utils";

/**
 * Démonstration marketing de PRONEX AI (brief, partie 6).
 *
 * Entièrement locale : AUCUN appel serveur, aucune génération OpenAI, aucun
 * crédit. Les 7 étapes sont celles du vrai moteur (lib/generation/stages.ts),
 * mais leur rythme est simulé ici, ce qui est annoncé au visiteur. Le match, les
 * statistiques et l'analyse sont fictifs et étiquetés « Démonstration ».
 */
const STEP_MS = 850;
const REDUCED_STEP_MS = 120;

type Phase = "idle" | "running" | "done";

const DEMO_STATS = [
  { label: "Buts marqués / match", home: "1,8", away: "1,1" },
  { label: "Buts encaissés / match", home: "0,9", away: "1,4" },
  { label: "Corners / match", home: "5,6", away: "4,2" },
] as const;

const DEMO_MARKETS = ["Résultat du match", "Double chance", "Nombre de buts", "Les deux équipes marquent", "Score exact", "Mi-temps", "Corners", "Cartons"] as const;

export function AiDemo({ marketCount }: { marketCount: number }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const timer = useRef<number | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  // Sur mobile, le résultat (dans la fiche) est au-dessus du bouton : on l'amène à l'écran s'il n'y est pas.
  useEffect(() => {
    if (phase !== "done") return;
    const element = resultRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    if (rect.top < 64 || rect.bottom > window.innerHeight) {
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      element.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
    }
  }, [phase]);

  function run() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? REDUCED_STEP_MS : STEP_MS;
    setPhase("running");
    setStep(0);
    const advance = (index: number) => {
      if (index >= VISUAL_STEPS.length) {
        setPhase("done");
        return;
      }
      setStep(index);
      timer.current = window.setTimeout(() => advance(index + 1), delay);
    };
    advance(0);
  }

  const progress = phase === "done" ? 100 : phase === "running" ? Math.round((step / VISUAL_STEPS.length) * 100) : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr] lg:items-start">
      {/* Fiche de match de démonstration */}
      <article aria-label="Fiche de match de démonstration" className="overflow-hidden rounded-3xl border border-white/10 bg-card">
        <header className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-3.5">
          <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Championnat · Samedi · 20:00</p>
          <DemoBadge />
        </header>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 text-center">
            <DemoTeam letter="A" name="Équipe A" form={["W", "W", "D", "W", "L"]} />
            <span className="pt-3 font-heading text-sm font-bold text-muted-foreground">VS</span>
            <DemoTeam letter="B" name="Équipe B" form={["L", "D", "W", "L", "D"]} />
          </div>

          <dl className="divide-y divide-white/5 rounded-2xl bg-white/[0.03] px-4 text-sm">
            {DEMO_STATS.map((row) => (
              <div key={row.label} className="grid grid-cols-[3rem_1fr_3rem] items-center py-2.5 text-center">
                <dd className="font-semibold tabular-nums">{row.home}</dd>
                <dt className="text-xs text-muted-foreground">{row.label}</dt>
                <dd className="font-semibold tabular-nums">{row.away}</dd>
              </div>
            ))}
          </dl>

          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              Marchés analysés{marketCount > 0 ? ` · ${marketCount} types` : ""}
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {DEMO_MARKETS.map((market) => (
                <li key={market} className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-muted-foreground">
                  {market}
                </li>
              ))}
            </ul>
          </div>

          <div ref={resultRef}>
            <DemoResult phase={phase} />
          </div>
        </div>
      </article>

      {/* Moteur PRONEX AI : progression de la démonstration */}
      <div className="rounded-3xl border border-white/10 bg-pronex-night p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-heading font-bold">
            <span className="flex size-8 items-center justify-center rounded-xl bg-pronex-violet/20 text-violet-100">
              <BrainCircuitIcon className="size-4" aria-hidden />
            </span>
            Moteur PRONEX AI
          </p>
          <span className="text-xs text-muted-foreground tabular-nums">{progress} %</span>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/8" role="progressbar" aria-label="Progression de la démonstration" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-pronex-pink transition-[width] duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>

        <ol className="mt-5 space-y-2.5">
          {VISUAL_STEPS.map((s, index) => {
            const state = phase === "done" || (phase === "running" && index < step) ? "done" : phase === "running" && index === step ? "active" : "pending";
            return (
              <li key={s.key} className={cn("flex items-start gap-3 rounded-xl px-2 py-1.5 transition-colors", state === "active" && "bg-pronex-violet/10")}>
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                    state === "done" && "border-success/50 bg-success/15 text-success",
                    state === "active" && "border-pronex-pink/60 bg-pronex-pink/15 text-pronex-pink",
                    state === "pending" && "border-white/10 text-muted-foreground",
                  )}
                >
                  {state === "done" ? <CheckIcon className="size-3" /> : state === "active" ? <LoaderCircleIcon className="size-3 animate-spin" /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-sm", state === "pending" ? "text-muted-foreground" : "font-medium text-foreground")}>{s.title}</span>
                  {state === "active" ? <span className="block text-xs text-muted-foreground">{s.detail}</span> : null}
                </span>
              </li>
            );
          })}
        </ol>

        <p className="sr-only" aria-live="polite">
          {phase === "running" ? `Étape ${step + 1} sur ${VISUAL_STEPS.length} : ${VISUAL_STEPS[step]?.title}` : phase === "done" ? "Démonstration terminée : résultat affiché." : ""}
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={run} disabled={phase === "running"} className={buttonVariants({ size: "lg", className: "px-6" })}>
            {phase === "idle" ? <PlayIcon aria-hidden /> : phase === "running" ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : <RotateCcwIcon aria-hidden />}
            {phase === "idle" ? "Voir une démonstration" : phase === "running" ? "Analyse de démonstration…" : "Rejouer la démonstration"}
          </button>
          {phase === "done" ? (
            <Link href="/inscription" className={buttonVariants({ variant: "outline", size: "lg", className: "px-6" })}>
              Accéder aux vraies analyses
            </Link>
          ) : null}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          Démonstration : aucune analyse réelle n&apos;est lancée, aucun crédit n&apos;est utilisé et le rythme des étapes est simulé. Les
          vraies analyses PRONEX AI sont disponibles après inscription.
        </p>
      </div>
    </div>
  );
}

function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-pronex-violet/40 bg-pronex-violet/15 px-2.5 py-0.5 text-[11px] font-semibold text-violet-100">
      <SparklesIcon className="size-3" aria-hidden />
      Démonstration
    </span>
  );
}

function DemoTeam({ letter, name, form }: { letter: string; name: string; form: ("W" | "D" | "L")[] }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span aria-hidden className="flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 font-heading font-bold">
        {letter}
      </span>
      <p className="text-sm font-semibold">{name}</p>
      <FormBadges results={form} size="sm" />
    </div>
  );
}

/** Résultat de la démonstration : verrouillé avant, révélé après les 7 étapes (contenu fictif). */
function DemoResult({ phase }: { phase: Phase }) {
  if (phase !== "done") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-white/12 px-4 py-4 text-sm text-muted-foreground">
        <LockIcon className="size-4 shrink-0 text-pronex-pink" aria-hidden />
        {phase === "running" ? "PRONEX AI prépare l'analyse de démonstration…" : "Lancez la démonstration pour voir le résultat de l'analyse."}
      </div>
    );
  }
  return (
    <div className="space-y-3 rounded-2xl border border-pronex-pink/30 bg-pronex-pink/[0.05] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">Résultat du match (1N2)</p>
          <p className="mt-1 font-heading text-xl font-bold">Victoire Équipe A</p>
        </div>
        <p className="text-right">
          <span className="block font-heading text-2xl font-extrabold tabular-nums">52 %</span>
          <span className="text-[11px] text-muted-foreground">probabilité estimée</span>
        </p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
        <div className="pronex-fill h-full rounded-full bg-pronex-pink" style={{ width: "52%" }} />
      </div>
      <p className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">Niveau de confiance</span>
        <span className="rounded-full bg-pronex-violet/20 px-2 py-0.5 font-semibold text-violet-100">Moyen</span>
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">Explication · </span>
        L&apos;Équipe A reste sur trois victoires lors de ses cinq derniers matchs et marque en moyenne 1,8 but par rencontre, quand
        l&apos;Équipe B encaisse 1,4 but par match. Le match nul reste possible (26 %) : la confiance est donc moyenne.
      </p>
    </div>
  );
}
