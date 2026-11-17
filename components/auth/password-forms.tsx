"use client";

import { FormMessage, TextField } from "@/components/forms/fields";
import { useZodForm } from "@/components/forms/use-zod-form";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { changePasswordAction, forgotPasswordAction, resetPasswordAction } from "@/lib/auth/actions";
import { forgotPasswordSchema, newPasswordSchema } from "@/lib/auth/schemas";

/** Demande d'un lien de réinitialisation. */
export function ForgotPasswordForm() {
  const { state, formAction, pending, errors, formMessage, onSubmit } = useZodForm(
    forgotPasswordSchema,
    forgotPasswordAction,
  );

  if (state.status === "success") {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Si un compte existe pour <strong className="text-foreground">{state.values?.email}</strong>, un e-mail
        contenant un lien de réinitialisation vient d&apos;être envoyé. Le lien est valable pendant une durée limitée.
      </p>
    );
  }

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="space-y-4">
      <FormMessage status={state.status} message={formMessage} />
      <FieldGroup>
        <TextField name="email" label="Adresse e-mail" type="email" autoComplete="email" inputMode="email"
          required defaultValue={state.values?.email} errors={errors.email} />
      </FieldGroup>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Envoi…" : "Recevoir un lien"}
      </Button>
    </form>
  );
}

function NewPasswordFields({ errors }: { errors: Record<string, string[] | undefined> }) {
  return (
    <FieldGroup>
      <TextField name="password" label="Nouveau mot de passe" type="password" autoComplete="new-password"
        required description="8 caractères minimum." errors={errors.password} />
      <TextField name="confirmPassword" label="Confirmation" type="password" autoComplete="new-password"
        required errors={errors.confirmPassword} />
    </FieldGroup>
  );
}

/** Saisie du nouveau mot de passe après le lien reçu par e-mail. */
export function ResetPasswordForm() {
  const { state, formAction, pending, errors, formMessage, onSubmit } = useZodForm(
    newPasswordSchema,
    resetPasswordAction,
  );
  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="space-y-4">
      <FormMessage status={state.status} message={formMessage} />
      <NewPasswordFields errors={errors} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer le mot de passe"}
      </Button>
    </form>
  );
}

/** Changement de mot de passe depuis le profil. */
export function ChangePasswordForm() {
  const { state, formAction, pending, errors, formMessage, onSubmit } = useZodForm(
    newPasswordSchema,
    changePasswordAction,
  );
  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="space-y-4">
      <FormMessage status={state.status} message={formMessage} />
      <NewPasswordFields errors={errors} />
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "Changer le mot de passe"}
      </Button>
    </form>
  );
}
