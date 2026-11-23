"use client";

import Link from "next/link";
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
  // Clé d'idempotence : une par confirmation ; un double clic renvoie la même demande.
  const keyRef = useRef<string | null>(null);
  const resumed = useRef(false);

  const option = options[selected];
  const insufficient = option ? balance < option.price : true;
  const busy = phase.kind === "reserving" || phase.kind === "running";
  const rechargeHref = `/recharger?next=${encodeURIComponent(`/matchs/${fixtureId}`)}`;

  async function run(requestId: string) {
    setPhase({ kind: "running" });
    const outcome = await runGenerationAction(requestId);
    if (outcome.status === "succeeded") {
      toast.success("Analyse IA prête : bonne lecture !");
      setOpen(false);
      setPhase({ kind: "idle" });
    } else if (outcome.status === "failed") {
      toast.error(outcome.message);
      setPhase({ kind: "error", message: outcome.message });
    } else {
      toast.info(outcome.message);
      setPhase({ kind: "error", message: outcome.message });
    }
    router.refresh(); // pronostics, solde et notifications rechargés depuis le serveur
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analyse IA à la demande</CardTitle>
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
              <label key={o.marketCode ?? "all"} className="flex cursor-pointer items-center justify-between gap-3 rounded-md border p-3 text-sm">
                <span className="flex items-center gap-2">
                  <input type="radio" name="generation-option" checked={selected === i} onChange={() => setSelected(i)} className="size-4" />
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
          <Button onClick={() => setOpen(true)} disabled={busy}>
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
