"use client";

import { useActionState, useState, type FormEvent } from "react";
import type { z } from "zod";
import { fieldErrorsOf, formDataToObject, initialFormState, type FormState } from "@/lib/forms";

type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

/**
 * Formulaire validé deux fois :
 *  1. dans le navigateur, avec le même schéma Zod, avant l'envoi (retour immédiat) ;
 *  2. sur le serveur, par la Server Action (validation qui fait foi).
 */
export function useZodForm<S extends z.ZodType>(schema: S, action: FormAction) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const [clientErrors, setClientErrors] = useState<FormState["fieldErrors"] | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const result = schema.safeParse(formDataToObject(new FormData(event.currentTarget)));
    if (!result.success) {
      event.preventDefault();
      setClientErrors(fieldErrorsOf(result.error));
      return;
    }
    setClientErrors(null);
  }

  const errors = clientErrors ?? state.fieldErrors ?? {};
  const formMessage = clientErrors ? "Certains champs sont invalides." : state.message;

  return { state, formAction, pending, errors, formMessage, onSubmit };
}
