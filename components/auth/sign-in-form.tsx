"use client";

import Link from "next/link";
import { FormMessage, TextField } from "@/components/forms/fields";
import { useZodForm } from "@/components/forms/use-zod-form";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { signInAction } from "@/lib/auth/actions";
import { signInSchema } from "@/lib/auth/schemas";

export function SignInForm({ next }: { next?: string }) {
  const { state, formAction, pending, errors, formMessage, onSubmit } = useZodForm(signInSchema, signInAction);
  const v = state.values ?? {};

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="space-y-4">
      <FormMessage status={state.status} message={formMessage} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FieldGroup>
        <TextField name="email" label="Adresse e-mail" type="email" autoComplete="email" inputMode="email"
          required defaultValue={v.email} errors={errors.email} />
        <TextField name="password" label="Mot de passe" type="password" autoComplete="current-password"
          required errors={errors.password} />
      </FieldGroup>
      <div className="text-right text-sm">
        <Link href="/mot-de-passe-oublie" className="underline underline-offset-4">
          Mot de passe oublié ?
        </Link>
      </div>
      <Button type="submit" variant="hero" size="lg" className="w-full" disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}
