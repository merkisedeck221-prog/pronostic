"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import { unlockPredictionAction } from "@/lib/credits/actions";
import { formatCredits } from "@/lib/utils/format";

type Props = {
  fixtureId: number;
  /** null = match complet. */
  marketCode: string | null;
  /** Libellé de ce qui est débloqué (« Score exact », « le match complet »). */
  label: string;
  /** Prix AFFICHÉ (calculé par la base) ; le serveur le recalcule au déblocage. */
  price: number;
  balance: number;
  buttonLabel: string;
  variant?: "default" | "outline";
};

export function UnlockButton({ fixtureId, marketCode, label, price, balance, buttonLabel, variant = "default" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<{ message: string; recharge: boolean } | null>(null);
  const insufficient = balance < price;
  const rechargeHref = `/recharger?next=${encodeURIComponent(`/matchs/${fixtureId}`)}`;

  function confirm() {
    if (pending) return; // double clic
    setError(null);
    startTransition(async () => {
      const result = await unlockPredictionAction(fixtureId, marketCode);
      if (result.ok) {
        toast.success(
          `Débloqué : ${label}. ${formatCredits(result.creditsSpent)} dépensé${result.creditsSpent > 1 ? "s" : ""}, nouveau solde : ${formatCredits(result.newBalance)}.`,
        );
        setOpen(false);
        router.refresh(); // carte, analyse et solde de l'en-tête rechargés depuis le serveur
        return;
      }
      if (result.code === "ALREADY_UNLOCKED") {
        toast.info(result.message);
        setOpen(false);
        router.refresh();
        return;
      }
      setError({ message: result.message, recharge: result.code === "INSUFFICIENT_BALANCE" });
      if (result.code === "MATCH_STARTED" || result.code === "MAINTENANCE") router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)} disabled={pending}>
        {buttonLabel}
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Débloquer {label}</AlertDialogTitle>
          <AlertDialogDescription render={<div />}>
            <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
              <dt>Prix</dt>
              <dd className="text-right font-medium tabular-nums">{formatCredits(price)}</dd>
              <dt>Solde actuel</dt>
              <dd className="text-right tabular-nums">{formatCredits(balance)}</dd>
              <dt>Solde après</dt>
              <dd className="text-right tabular-nums">{insufficient ? "—" : formatCredits(balance - price)}</dd>
            </dl>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {insufficient || error?.recharge ? (
          <p className="text-sm text-destructive">Solde insuffisant : rechargez votre compte pour débloquer ce pronostic.</p>
        ) : error ? (
          <p className="text-sm text-destructive" role="alert">
            {error.message}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
          {insufficient || error?.recharge ? (
            <Link href={rechargeHref} className={buttonVariants()}>
              Recharger
            </Link>
          ) : (
            <Button onClick={confirm} disabled={pending}>
              {pending ? "Déblocage…" : `Confirmer (${formatCredits(price)})`}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
