"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { startTopupAction, type StartTopupState } from "@/lib/payments/actions";

/** Bouton de choix d'un pack. Seuls l'identifiant du pack et `next` sont envoyés : jamais de montant. */
export function TopupForm({ packId, next, label, disabled }: { packId: number; next: string; label: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState<StartTopupState, FormData>(startTopupAction, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="packId" value={packId} />
      <input type="hidden" name="next" value={next} />
      <Button type="submit" className="w-full" disabled={pending || disabled}>
        {pending ? "Redirection…" : label}
      </Button>
      {state?.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
