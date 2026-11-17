import { z } from "zod";

/**
 * État renvoyé par les Server Actions de formulaire (useActionState).
 * Les mots de passe ne sont jamais renvoyés dans `values`.
 */
export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };

const SECRET_FIELDS = new Set(["password", "confirmPassword"]);

/** FormData → objet simple (une valeur par champ). */
export function formDataToObject(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) result[key] = value;
  }
  return result;
}

/** Valeurs à réafficher dans le formulaire après une erreur (sans les mots de passe). */
export function safeValues(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).filter(([key]) => !SECRET_FIELDS.has(key)));
}

export function fieldErrorsOf(error: z.ZodError): Record<string, string[] | undefined> {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

/** Valide des données de formulaire ; renvoie soit les données, soit un FormState d'erreur. */
export function validateForm<S extends z.ZodType>(
  schema: S,
  values: Record<string, string>,
): { ok: true; data: z.infer<S> } | { ok: false; state: FormState } {
  const result = schema.safeParse(values);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    state: {
      status: "error",
      message: "Certains champs sont invalides.",
      fieldErrors: fieldErrorsOf(result.error),
      values: safeValues(values),
    },
  };
}
