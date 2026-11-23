"use client";

import { createContext, useActionState, useContext, useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startTopupAction, type StartTopupState } from "@/lib/payments/actions";

/** Code promo saisi une seule fois, partagé par tous les boutons de pack. */
const PromoCodeContext = createContext<string>("");

export function PromoCodeProvider({ children }: { children: ReactNode }) {
  const [code, setCode] = useState("");
  const id = useId();
  return (
    <PromoCodeContext.Provider value={code}>
      <div className="max-w-sm space-y-1.5">
        <Label htmlFor={id}>Code promo (facultatif)</Label>
        <Input
          id={id}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 30))}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="EX. BIENVENUE"
        />
        <p className="text-xs text-muted-foreground">Le bonus est vérifié et ajouté au moment du paiement.</p>
      </div>
      {children}
    </PromoCodeContext.Provider>
  );
}

/**
 * Bouton de choix d'un pack. Seuls l'identifiant du pack, le code promo (texte)
 * et `next` sont envoyés : jamais de montant ni de nombre de crédits.
 */
export function TopupForm({ packId, next, label, disabled }: { packId: number; next: string; label: string; disabled?: boolean }) {
  const promoCode = useContext(PromoCodeContext);
  const [state, action, pending] = useActionState<StartTopupState, FormData>(startTopupAction, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="packId" value={packId} />
      <input type="hidden" name="promoCode" value={promoCode} />
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
