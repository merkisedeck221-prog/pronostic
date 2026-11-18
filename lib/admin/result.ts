/** État renvoyé par les Server Actions admin (affiché par AdminActionForm). */
export type AdminActionState = { ok: true; message: string } | { ok: false; error: string } | null;

export function success(message: string): AdminActionState {
  return { ok: true, message };
}

export function failure(error: string): AdminActionState {
  return { ok: false, error };
}

/** Message d'une réponse JSON d'une fonction SQL admin ({ ok, code, message }). */
export function sqlFailure(data: unknown, fallback = "Action refusée."): AdminActionState {
  const value = (data ?? {}) as { code?: string; message?: string };
  if (value.code === "FORBIDDEN") return failure("Action réservée aux administrateurs.");
  return failure(value.message ?? (value.code ? `${fallback} (${value.code})` : fallback));
}

export function isOk(data: unknown): boolean {
  return typeof data === "object" && data !== null && (data as { ok?: unknown }).ok === true;
}
