"use client";

import Link from "next/link";
import { CheckboxField, FormMessage, SelectField, TextField } from "@/components/forms/fields";
import { useZodForm } from "@/components/forms/use-zod-form";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { signUpAction } from "@/lib/auth/actions";
import { signUpSchema } from "@/lib/auth/schemas";
import { COUNTRY_OPTIONS, DEFAULT_COUNTRY } from "@/lib/utils/locales";

export function SignUpForm() {
  const { state, formAction, pending, errors, formMessage, onSubmit } = useZodForm(signUpSchema, signUpAction);

  if (state.status === "success") {
    return (
      <div role="status" className="space-y-3">
        <h2 className="text-lg font-semibold">Vérifiez votre boîte mail</h2>
        <p className="text-sm text-muted-foreground">
          Si l&apos;adresse <strong className="text-foreground">{state.values?.email}</strong> peut être utilisée,
          vous allez recevoir un e-mail de confirmation. Cliquez sur le lien qu&apos;il contient pour activer votre
          compte, puis connectez-vous.
        </p>
        <p className="text-sm text-muted-foreground">
          Rien reçu après quelques minutes ? Vérifiez vos courriers indésirables.
        </p>
        <Link href="/connexion" className="text-sm font-medium underline underline-offset-4">
          Aller à la connexion
        </Link>
      </div>
    );
  }

  const v = state.values ?? {};

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="space-y-4">
      <FormMessage status={state.status} message={formMessage} />
      <FieldGroup>
        <TextField name="email" label="Adresse e-mail" type="email" autoComplete="email" inputMode="email"
          required defaultValue={v.email} errors={errors.email} />
        <TextField name="password" label="Mot de passe" type="password" autoComplete="new-password"
          required description="8 caractères minimum." errors={errors.password} />
        <TextField name="confirmPassword" label="Confirmation du mot de passe" type="password"
          autoComplete="new-password" required errors={errors.confirmPassword} />
        <TextField name="displayName" label="Nom d'affichage" autoComplete="nickname" required
          defaultValue={v.displayName} errors={errors.displayName} />
        <SelectField name="country" label="Pays" required options={COUNTRY_OPTIONS}
          defaultValue={v.country ?? DEFAULT_COUNTRY} errors={errors.country} />
        <TextField name="phone" label="Téléphone" type="tel" autoComplete="tel" inputMode="tel"
          placeholder="+229 01 23 45 67" defaultValue={v.phone} errors={errors.phone}
          description="Utile plus tard pour le paiement par Mobile Money." />
        <CheckboxField
          name="acceptTerms"
          defaultChecked={v.acceptTerms === "on"}
          errors={errors.acceptTerms}
          label={
            <>
              J&apos;ai 18 ans ou plus et j&apos;accepte les{" "}
              <Link href="/cgu" target="_blank" className="font-medium underline underline-offset-4">
                conditions générales d&apos;utilisation
              </Link>
              .
            </>
          }
        />
      </FieldGroup>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Création du compte…" : "Créer mon compte"}
      </Button>
    </form>
  );
}
