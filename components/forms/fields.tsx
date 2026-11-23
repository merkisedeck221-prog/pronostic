import type { ReactNode } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PasswordInput } from "./password-input";

/**
 * Champs de formulaire sobres (shadcn/ui), avec message d'erreur sous le champ.
 * Les champs restent non contrôlés : `defaultValue` permet de réafficher la
 * saisie après une erreur renvoyée par le serveur.
 */

type BaseProps = {
  name: string;
  label: string;
  errors?: string[];
  description?: ReactNode;
  required?: boolean;
};

function toFieldErrors(errors?: string[]) {
  return errors?.map((message) => ({ message }));
}

export function TextField({
  name,
  label,
  errors,
  description,
  required,
  type = "text",
  defaultValue,
  autoComplete,
  placeholder,
  inputMode,
}: BaseProps & {
  type?: "text" | "email" | "password" | "tel";
  defaultValue?: string;
  autoComplete?: string;
  placeholder?: string;
  inputMode?: "text" | "email" | "tel";
}) {
  const invalid = Boolean(errors?.length);
  const inputProps = {
    id: name,
    name,
    defaultValue,
    autoComplete,
    placeholder,
    inputMode,
    required,
    "aria-invalid": invalid || undefined,
    "aria-describedby": invalid ? `${name}-error` : undefined,
  };
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={name}>
        {label}
        {required ? null : <span className="font-normal text-muted-foreground">(facultatif)</span>}
      </FieldLabel>
      {type === "password" ? <PasswordInput {...inputProps} /> : <Input {...inputProps} type={type} />}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError id={`${name}-error`} errors={toFieldErrors(errors)} />
    </Field>
  );
}

const selectClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30";

export function SelectField({
  name,
  label,
  errors,
  description,
  required,
  options,
  defaultValue,
}: BaseProps & {
  options: readonly { value: string; label: string }[];
  defaultValue?: string;
}) {
  const invalid = Boolean(errors?.length);
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        required={required}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${name}-error` : undefined}
        className={cn(selectClassName)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError id={`${name}-error`} errors={toFieldErrors(errors)} />
    </Field>
  );
}

export function CheckboxField({
  name,
  label,
  errors,
  defaultChecked,
}: Omit<BaseProps, "description" | "required" | "label"> & { label: ReactNode; defaultChecked?: boolean }) {
  const invalid = Boolean(errors?.length);
  return (
    <Field data-invalid={invalid || undefined}>
      <div className="flex items-start gap-2">
        <input
          id={name}
          name={name}
          type="checkbox"
          defaultChecked={defaultChecked}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${name}-error` : undefined}
          className="mt-0.5 size-4 shrink-0 accent-primary"
        />
        <label htmlFor={name} className="text-sm leading-snug">
          {label}
        </label>
      </div>
      <FieldError id={`${name}-error`} errors={toFieldErrors(errors)} />
    </Field>
  );
}

/** Message global du formulaire (erreur ou succès). */
export function FormMessage({ status, message }: { status: "idle" | "error" | "success"; message?: string }) {
  if (!message || status === "idle") return null;
  return (
    <p
      role={status === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        status === "error"
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-border bg-muted text-foreground",
      )}
    >
      {message}
    </p>
  );
}
