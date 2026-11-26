"use client";

import Link from "next/link";
import { SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requestGenerationAction, runGenerationAction } from "@/lib/generation/actions";
import type { GenerationOption } from "@/lib/generation/queries";
import { formatCredits } from "@/lib/utils/format";
import { AiGenerationProgress, type ServerOutcome } from "./ai-generation-progress";

type Props = {
  fixtureId: number;
  options: GenerationOption[];
  balance: number;
  /** Demande déjà en cours (reprise après rechargement de la page). */
  activeRequestId: string | null;
};

type Phase = { kind: "idle" } | { kind: "reserving" } | { kind: "running" } | { kind: "error"; message: string; recharge?: boolean };

/**
 * Génération à la demande (module 3) : choix du type d'analyse, coût calculé
 * par la base, confirmation, réservation des crédits, IA, puis débit définitif
 * ou crédits rendus. Le navigateur n'envoie jamais de prix.
 */
export function GeneratePanel({ fixtureId, options, balance, activeRequestId }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState(0);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>(activeRequestId ? { kind: "running" } : { kind: "idle" });
  // Suivi de l'animation : demande en cours et issue réelle renvoyée par le serveur.
  const [tracked, setTracked] = useState<string | null>(activeRequestId);
  const [outcome, setOutcome] = useState<ServerOutcome>(null);
  // Clé d'idempotence : une par confirmation ; un double clic renvoie la même demande.
  const keyRef = useRef<string | null>(null);
  const resumed = useRef(false);

  const option = options[selected];
  const insufficient = option ? balance < option.price : true;
  const busy = phase.kind === "reserving" || phase.kind === "running";
  const rechargeHref = `/recharger?next=${encodeURIComponent(`/matchs/${fixtureId}`)}`;

  async function run(requestId: string) {
    setTracked(requestId);
    setOutcome(null);
    setOpen(false);
    setPhase({ kind: "running" });
    const result = await runGenerationAction(requestId);
    setOutcome(result.status === "succeeded" ? { status: "succeeded" } : { status: result.status, message: result.message });
    if (result.status === "succeeded") {
      toast.success("Analyse IA validée : vos pronostics sont prêts.");
      setPhase({ kind: "idle" });
      // Laisse voir l'étape finale, puis affiche les cartes (rechargées depuis le serveur).
      setTimeout(() => router.refresh(), 6_000);
      return;
    }
    if (result.status === "failed") toast.error(result.message);
    else toast.info(result.message);
    setPhase({ kind: "error", message: result.message });
    router.refresh(); // solde et notifications rechargés depuis le serveur
  }

  useEffect(() => {
    if (activeRequestId && !resumed.current) {
      resumed.current = true;
      void run(activeRequestId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRequestId]);

  async function confirm() {
    if (busy || !option) return;
    keyRef.current ??= crypto.randomUUID();
    setPhase({ kind: "reserving" });
    const result = await requestGenerationAction(fixtureId, option.marketCode, keyRef.current);
    if (!result.ok) {
      keyRef.current = null;
      setPhase({ kind: "error", message: result.message, recharge: result.code === "INSUFFICIENT_BALANCE" });
      if (result.code === "ALREADY_AVAILABLE" || result.code === "ALREADY_UNLOCKED") router.refresh();
      return;
    }
    keyRef.current = null;
    await run(result.requestId);
  }

  if (options.length === 0) return null;

  if (tracked) {
    return (
      <div className="space-y-3">
        <AiGenerationProgress requestId={tracked} outcome={outcome} onShowResult={() => router.refresh()} />
        {outcome && outcome.status !== "succeeded" ? (
          <Button
            variant="outline"
            onClick={() => {
              setTracked(null);
              setOutcome(null);
              setPhase({ kind: "idle" });
            }}
          >
            {outcome.status === "failed" ? "Choisir une autre analyse" : "Revenir au choix des analyses"}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SparklesIcon className="size-4 text-pronex-pink" aria-hidden />
          Analyse PRONEX AI à la demande
        </CardTitle>
        <CardDescription>
          Aucun pronostic n&apos;est encore publié pour ce match. Lancez l&apos;analyse : les crédits sont réservés, puis débités
          seulement si l&apos;analyse réussit (sinon, ils vous sont rendus).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {phase.kind === "running" ? (
          <p className="text-sm" role="status" aria-live="polite">
            Analyse en cours… Cela peut prendre jusqu&apos;à une minute. Vous pouvez quitter la page : vous serez notifié.
          </p>
        ) : (
          <fieldset className="space-y-2">
            <legend className="sr-only">Type d&apos;analyse</legend>
            {options.map((o, i) => (
              <label
                key={o.marketCode ?? "all"}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-muted p-3 text-sm transition-colors has-[:checked]:border-pronex-violet/60 has-[:checked]:bg-pronex-violet/10"
              >
                <span className="flex items-center gap-2">
                  <input type="radio" name="generation-option" checked={selected === i} onChange={() => setSelected(i)} className="size-4 accent-pronex-violet" />
                  {o.label}
                </span>
                <span className="font-medium tabular-nums">{formatCredits(o.price)}</span>
              </label>
            ))}
          </fieldset>
        )}
        {phase.kind === "error" && !open ? (
          <p className="text-sm text-destructive" role="alert">
            {phase.message}
          </p>
        ) : null}

        <AlertDialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
          <Button variant="hero" size="lg" onClick={() => setOpen(true)} disabled={busy}>
            {busy ? "Analyse en cours…" : "Générer l'analyse"}
          </Button>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Générer : {option?.label}</AlertDialogTitle>
              <AlertDialogDescription render={<div />}>
                <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
                  <dt>Coût (réservé, débité si l&apos;analyse réussit)</dt>
                  <dd className="text-right font-medium tabular-nums">{option ? formatCredits(option.price) : "—"}</dd>
                  <dt>Solde actuel</dt>
                  <dd className="text-right tabular-nums">{formatCredits(balance)}</dd>
                  <dt>Solde après</dt>
                  <dd className="text-right tabular-nums">{insufficient || !option ? "—" : formatCredits(balance - option.price)}</dd>
                </dl>
              </AlertDialogDescription>
            </AlertDialogHeader>
            {phase.kind === "running" ? (
              <p className="text-sm" role="status">
                Analyse en cours…
              </p>
            ) : insufficient || (phase.kind === "error" && phase.recharge) ? (
              <p className="text-sm text-destructive">Solde insuffisant : rechargez votre compte.</p>
            ) : phase.kind === "error" ? (
              <p className="text-sm text-destructive" role="alert">
                {phase.message}
              </p>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Fermer</AlertDialogCancel>
              {insufficient ? (
                <Link href={rechargeHref} className={buttonVariants()}>
                  Recharger
                </Link>
              ) : (
                <Button onClick={confirm} disabled={busy}>
                  {phase.kind === "reserving" ? "Réservation…" : phase.kind === "running" ? "Analyse en cours…" : `Confirmer (${formatCredits(option?.price ?? 0)})`}
                </Button>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
