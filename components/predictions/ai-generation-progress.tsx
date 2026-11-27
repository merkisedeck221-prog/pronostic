"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangleIcon, CheckIcon, Clock3Icon, SparklesIcon, XIcon } from "lucide-react";
import { generationProgressSchema, progressView, VISUAL_STEPS, type GenerationProgress, type StepState } from "@/lib/generation/stages";
import { cn } from "@/lib/utils";

export const POLL_INTERVAL_MS = 1_500;

/** Issue renvoyée par le serveur à la fin du traitement (Server Action de génération). */
export type ServerOutcome = { status: "succeeded" } | { status: "failed"; message: string } | { status: "pending"; message: string } | null;

/**
 * Animation PRONEX AI (étape 6) : 7 étapes visuelles dont l'état vient
 * UNIQUEMENT du serveur (phase réelle lue toutes les 1,5 s sur
 * /api/generation/[id]). La barre ne progresse que lorsqu'une étape est
 * réellement terminée ; l'étape en cours a sa propre animation, sans
 * pourcentage inventé. Le résultat final n'apparaît qu'après validation
 * (statut « succeeded »).
 */
export function AiGenerationProgress({
  requestId,
  outcome,
  onShowResult,
}: {
  requestId: string;
  outcome: ServerOutcome;
  onShowResult: () => void;
}) {
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef<number | null>(null);

  // Lecture de la phase réelle tant que le traitement n'est pas terminé.
  const settled = outcome !== null || progress?.status === "succeeded" || progress?.status === "failed";
  useEffect(() => {
    // Une dernière lecture après l'issue : l'animation s'arrête sur l'étape réellement atteinte.
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/generation/${requestId}`, { cache: "no-store" });
        if (!response.ok) return;
        const parsed = generationProgressSchema.safeParse(await response.json());
        if (!cancelled && parsed.success) setProgress(parsed.data);
      } catch {
        /* réseau : nouvel essai au prochain intervalle */
      }
    };
    void poll();
    const timer = settled ? null : setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [requestId, settled]);

  // Temps écoulé réel (affiché, jamais utilisé pour faire avancer la progression).
  useEffect(() => {
    startedAt.current ??= Date.now();
    if (settled) return;
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - (startedAt.current ?? Date.now())) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [settled]);

  // L'issue du serveur prime : « succeeded » n'est renvoyé qu'après validation et accès donné.
  const status = outcome?.status === "succeeded" ? "succeeded" : outcome?.status === "failed" ? "failed" : (progress?.status ?? "reserved");
  const view = progressView(status, progress?.stage ?? null);
  const pending = outcome?.status === "pending";
  const percent = Math.round((view.completed / VISUAL_STEPS.length) * 100);

  return (
    <section
      aria-labelledby="pronex-ai-progress"
      className="relative overflow-hidden rounded-3xl border border-pronex-violet/30 bg-card p-5 sm:p-6"
    >
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-pronex-violet/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-20 size-64 rounded-full bg-pronex-pink/10 blur-3xl" />

      <header className="relative flex items-center gap-4">
        <AiCore state={view.finished ? "done" : view.failed ? "failed" : pending ? "paused" : "working"} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-[0.2em] text-pronex-pink uppercase">PRONEX AI</p>
          <h2 id="pronex-ai-progress" className="text-lg font-bold">
            {view.finished
              ? "Analyse terminée et validée"
              : view.failed
                ? "Analyse interrompue"
                : pending
                  ? "Analyse toujours en cours"
                  : view.shared
                    ? "Analyse de ce match déjà en cours"
                    : "Analyse du match en cours"}
          </h2>
          <p className="text-xs text-muted-foreground tabular-nums" aria-live="off">
            {view.finished || view.failed ? `Durée : ${elapsed} s` : `Temps écoulé : ${elapsed} s · étape ${Math.min(view.completed + 1, 7)} sur 7`}
          </p>
        </div>
      </header>

      {/* Barre : uniquement les étapes réellement terminées. */}
      <div className="relative mt-5">
        <div
          className="h-2 overflow-hidden rounded-full bg-white/8"
          role="progressbar"
          aria-label="Étapes terminées"
          aria-valuemin={0}
          aria-valuemax={7}
          aria-valuenow={view.completed}
          aria-valuetext={`${view.completed} étape${view.completed > 1 ? "s" : ""} terminée${view.completed > 1 ? "s" : ""} sur 7`}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-700 ease-out",
              view.failed ? "bg-destructive" : "bg-linear-to-r from-pronex-pink to-pronex-violet",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-1.5 text-right text-xs text-muted-foreground tabular-nums">
          {view.completed} / 7 étapes terminées
        </p>
      </div>

      <ol className="relative mt-4 space-y-1" aria-live="polite">
        {VISUAL_STEPS.map((step, index) => (
          <StepRow key={step.key} index={index} title={step.title} detail={step.detail} state={view.steps[index]} />
        ))}
      </ol>

      {view.shared && !view.finished && !view.failed ? (
        <p className="relative mt-4 rounded-xl border border-pronex-violet/30 bg-pronex-violet/10 p-3 text-sm text-violet-100">
          Un autre utilisateur a déjà lancé l&apos;analyse de ce match. PRONEX AI produit un seul jeu de pronostics par match :
          vous recevrez le même résultat dès qu&apos;il sera validé. Le détail de ses étapes n&apos;est pas visible d&apos;ici.
        </p>
      ) : null}

      {view.failed ? (
        <div role="alert" className="relative mt-4 flex gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <XIcon className="mt-0.5 size-4 shrink-0 text-red-400" aria-hidden />
          <p>{outcome?.status === "failed" ? outcome.message : "L'analyse n'a pas pu être produite. Vos crédits ont été rendus."}</p>
        </div>
      ) : null}

      {pending ? (
        <div role="status" className="relative mt-4 flex gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
          <Clock3Icon className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p>
            {outcome?.status === "pending" ? outcome.message : ""} Vos crédits restent réservés : ils sont débités seulement si
            l&apos;analyse aboutit, sinon rendus automatiquement.
          </p>
        </div>
      ) : null}

      {view.finished ? (
        <div className="relative mt-5 overflow-hidden rounded-2xl bg-linear-to-r from-pronex-pink/60 to-pronex-violet/60 p-px">
          <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-sm">
              <SparklesIcon className="size-4 text-pronex-pink" aria-hidden />
              Analyse validée par les contrôles de qualité. Vos pronostics sont prêts.
            </p>
            <button
              type="button"
              onClick={onShowResult}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-linear-to-r from-pronex-pink/85 to-pronex-violet px-5 text-sm font-semibold text-on-accent shadow-[0_0_28px_-10px] shadow-pronex-pink/70 transition hover:brightness-110"
            >
              Voir les pronostics
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function StepRow({ index, title, detail, state }: { index: number; title: string; detail: string; state: StepState }) {
  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-xl px-2 py-2 transition-colors duration-500",
        state === "active" && "bg-white/[0.04]",
      )}
      aria-current={state === "active" ? "step" : undefined}
    >
      <StepIcon index={index} state={state} />
      <div className="min-w-0 pt-1">
        <p
          className={cn(
            "text-sm font-semibold transition-colors duration-500",
            state === "pending" && "text-muted-foreground",
            state === "failed" && "text-red-400",
          )}
        >
          {title}
          <span className="sr-only">
            {" "}
            : {state === "done" ? "terminée" : state === "active" ? "en cours" : state === "failed" ? "en échec" : state === "shared" ? "traitement mutualisé" : "à venir"}
          </span>
        </p>
        {state === "active" || state === "failed" ? (
          <p className="text-xs text-muted-foreground motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1">{detail}</p>
        ) : null}
        {state === "active" ? <ActiveScan /> : null}
      </div>
    </li>
  );
}

function StepIcon({ index, state }: { index: number; state: StepState }) {
  if (state === "done") {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success/15 text-success ring-1 ring-success/40 motion-safe:animate-in motion-safe:zoom-in-50">
        <CheckIcon className="size-4" aria-hidden />
      </span>
    );
  }
  if (state === "failed") {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-red-400 ring-1 ring-destructive/50">
        <AlertTriangleIcon className="size-4" aria-hidden />
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="relative flex size-8 shrink-0 items-center justify-center">
        <span aria-hidden className="absolute inset-0 rounded-full bg-pronex-pink/20 motion-safe:animate-ping" />
        <span
          aria-hidden
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-pronex-pink border-r-pronex-violet motion-safe:animate-spin"
        />
        <span className="relative font-heading text-xs font-bold text-white">{index + 1}</span>
      </span>
    );
  }
  if (state === "shared") {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed border-pronex-violet/60 font-heading text-xs font-bold text-violet-200">
        {index + 1}
      </span>
    );
  }
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 font-heading text-xs font-bold text-muted-foreground">
      {index + 1}
    </span>
  );
}

/** Balayage de l'étape en cours : indique une activité, sans durée ni pourcentage inventés. */
function ActiveScan() {
  return (
    <span aria-hidden className="mt-2 block h-1 w-40 max-w-full overflow-hidden rounded-full bg-white/8">
      <span className="pronex-scan block h-full w-1/3 rounded-full bg-linear-to-r from-transparent via-pronex-pink to-transparent" />
    </span>
  );
}

/** Noyau « IA » : orbites et réseau de points, animé tant que le traitement est actif. */
function AiCore({ state }: { state: "working" | "done" | "failed" | "paused" }) {
  const color = state === "done" ? "text-success" : state === "failed" ? "text-red-400" : "text-pronex-pink";
  return (
    <span aria-hidden className={cn("relative flex size-14 shrink-0 items-center justify-center", color)}>
      <svg viewBox="0 0 56 56" className={cn("absolute inset-0", state === "working" && "motion-safe:animate-[spin_6s_linear_infinite]")}>
        <circle cx="28" cy="28" r="25" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeDasharray="3 5" />
        <circle cx="28" cy="3" r="2.2" fill="#ff1493" />
        <circle cx="53" cy="28" r="1.6" fill="#a000ff" />
      </svg>
      <svg viewBox="0 0 56 56" className={cn("absolute inset-2", state === "working" && "motion-safe:animate-[spin_4s_linear_infinite_reverse]")}>
        <circle cx="20" cy="20" r="17" fill="none" stroke="#a000ff" strokeOpacity="0.35" strokeDasharray="10 6" />
      </svg>
      <span className={cn("relative flex size-7 items-center justify-center rounded-full bg-current/15 ring-1 ring-current/40", state === "working" && "motion-safe:animate-pulse")}>
        {state === "done" ? <CheckIcon className="size-4" /> : state === "failed" ? <XIcon className="size-4" /> : <SparklesIcon className="size-4" />}
      </span>
    </span>
  );
}
