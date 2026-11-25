"use client";

import { useActionState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { AdminActionState } from "@/lib/admin/result";
import { cn } from "@/lib/utils";

type Props = {
  action: (prev: AdminActionState, formData: FormData) => Promise<AdminActionState>;
  /** Champs cachés envoyés avec le formulaire. */
  hidden?: Record<string, string | number>;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  variant?: "default" | "outline" | "destructive" | "secondary" | "ghost";
  size?: "default" | "sm";
  /** Message de confirmation (boîte de dialogue du navigateur) avant l'envoi. */
  confirmMessage?: string;
  disabled?: boolean;
  className?: string;
  inline?: boolean;
};

/**
 * Formulaire d'une Server Action admin : bouton désactivé pendant le
 * traitement, confirmation facultative, message de résultat.
 */
export function AdminActionForm({
  action,
  hidden,
  children,
  submitLabel,
  pendingLabel = "En cours…",
  variant = "default",
  size = "sm",
  confirmMessage,
  disabled,
  className,
  inline,
}: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
      }}
      className={cn(inline ? "inline-flex flex-wrap items-center gap-2" : "space-y-2", className)}
    >
      {hidden ? Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />) : null}
      {children}
      <Button type="submit" variant={variant} size={size} disabled={pending || disabled}>
        {pending ? pendingLabel : submitLabel}
      </Button>
      {state ? (
        <p role={state.ok ? "status" : "alert"} className={cn("text-sm", state.ok ? "text-emerald-300" : "text-destructive")}>
          {state.ok ? state.message : state.error}
        </p>
      ) : null}
    </form>
  );
}
