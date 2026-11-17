"use client";

import { FormMessage, SelectField, TextField } from "@/components/forms/fields";
import { useZodForm } from "@/components/forms/use-zod-form";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { updateProfileAction } from "@/lib/auth/actions";
import { profileSchema } from "@/lib/auth/schemas";
import { COUNTRY_OPTIONS, DEFAULT_COUNTRY, DEFAULT_TIMEZONE, TIMEZONE_OPTIONS } from "@/lib/utils/locales";

export type ProfileFormDefaults = {
  displayName: string;
  country: string | null;
  phone: string | null;
  timezone: string;
};

export function ProfileForm({ defaults }: { defaults: ProfileFormDefaults }) {
  const { state, formAction, pending, errors, formMessage, onSubmit } = useZodForm(
    profileSchema,
    updateProfileAction,
  );
  const v = state.values ?? {};

  // Fuseau hors liste (ancien compte, saisie admin) : on l'affiche quand même.
  const timezoneOptions = TIMEZONE_OPTIONS.some((option) => option.value === defaults.timezone)
    ? TIMEZONE_OPTIONS
    : [{ value: defaults.timezone, label: defaults.timezone }, ...TIMEZONE_OPTIONS];

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="space-y-4">
      <FormMessage status={state.status} message={formMessage} />
      <FieldGroup>
        <TextField name="displayName" label="Nom d'affichage" autoComplete="nickname" required
          defaultValue={v.displayName ?? defaults.displayName} errors={errors.displayName} />
        <SelectField name="country" label="Pays" required options={COUNTRY_OPTIONS}
          defaultValue={v.country ?? defaults.country ?? DEFAULT_COUNTRY} errors={errors.country} />
        <TextField name="phone" label="Téléphone" type="tel" autoComplete="tel" inputMode="tel"
          placeholder="+229 01 23 45 67" defaultValue={v.phone ?? defaults.phone ?? ""} errors={errors.phone} />
        <SelectField name="timezone" label="Fuseau horaire" required options={timezoneOptions}
          defaultValue={v.timezone ?? defaults.timezone ?? DEFAULT_TIMEZONE} errors={errors.timezone}
          description="Les heures des matchs sont affichées dans ce fuseau." />
      </FieldGroup>
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}
