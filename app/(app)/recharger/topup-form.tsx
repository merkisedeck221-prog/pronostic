"use client";

import { useActionState } from "react";
import { startTopupAction, type StartTopupState } from "@/lib/payments/actions";
import { cn } from "@/lib/utils";

/**
 * Bouton d'achat d'un pack. Seuls l'identifiant du pack et `next` sont
 * envoyés : jamais de montant ni de nombre de crédits (lus en base).
 */
export function TopupForm({
  packId,
  next,
  label,
  disabled,
  featured,
}: {
  packId: number;
  next: string;
  label: string;
  disabled?: boolean;
  featured?: boolean;
}) {
  const [state, action, pending] = useActionState<StartTopupState, FormData>(startTopupAction, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="packId" value={packId} />
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        disabled={pending || disabled}
        className={cn(
          "h-11 w-full rounded-lg px-4 text-sm font-semibold text-white transition outline-none",
          "focus-visible:ring-3 focus-visible:ring-pronex-pink/60 disabled:cursor-not-allowed disabled:opacity-50",
          featured
            ? "bg-linear-to-r from-pronex-pink/85 to-pronex-violet hover:brightness-110"
            : "border border-white/15 bg-white/5 hover:border-pronex-pink/70 hover:bg-white/10",
        )}
      >
        {pending ? "Redirection…" : label}
      </button>
      {state?.error ? (
        <p className="text-sm text-pronex-pink" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
