import { z } from "zod";
import { COUNTRY_CODES, TIMEZONE_VALUES } from "@/lib/utils/locales";

/**
 * Schémas Zod des formulaires d'authentification et de profil.
 * Partagés entre le navigateur (validation immédiate) et le serveur
 * (validation faisant foi dans les Server Actions). Messages en français.
 */

const trimmed = (value: unknown) => (typeof value === "string" ? value.trim() : value);
const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const emailSchema = z.preprocess(
  trimmed,
  z.email({ error: "Adresse e-mail invalide." }).max(254, { error: "Adresse e-mail trop longue." }),
);

/** 8 caractères minimum (cahier des charges), 72 maximum (limite de Supabase Auth). */
export const passwordSchema = z
  .string({ error: "Mot de passe requis." })
  .min(8, { error: "Le mot de passe doit contenir au moins 8 caractères." })
  .max(72, { error: "Le mot de passe ne doit pas dépasser 72 caractères." });

export const displayNameSchema = z.preprocess(
  trimmed,
  z
    .string({ error: "Nom d'affichage requis." })
    .min(2, { error: "Le nom d'affichage doit contenir au moins 2 caractères." })
    .max(50, { error: "Le nom d'affichage ne doit pas dépasser 50 caractères." }),
);

export const countrySchema = z.enum(COUNTRY_CODES, { error: "Choisissez un pays dans la liste." });

/** Facultatif : chiffres et espaces, « + » initial autorisé (même règle que la base). */
export const phoneSchema = z.preprocess(
  blankToUndefined,
  z
    .string()
    .regex(/^\+?[0-9 ]{6,20}$/, { error: "Numéro de téléphone invalide (chiffres uniquement, ex. +229 01 23 45 67)." })
    .optional(),
);

export const timezoneSchema = z.enum(TIMEZONE_VALUES, { error: "Choisissez un fuseau horaire dans la liste." });

/** Case à cocher HTML : « on » si cochée, absente sinon. */
const acceptTermsSchema = z.preprocess(
  (value) => value === "on" || value === "true" || value === true,
  z.literal(true, { error: "Vous devez avoir 18 ans ou plus et accepter les CGU." }),
);

const passwordsMatch = <T extends { password: string; confirmPassword: string }>(data: T) =>
  data.password === data.confirmPassword;
const passwordsMismatch = {
  error: "Les mots de passe ne correspondent pas.",
  path: ["confirmPassword"],
  // Vérifié même si d'autres champs (e-mail, nom…) sont invalides, dès que les
  // deux champs de mot de passe sont eux-mêmes valides.
  when(payload: { issues: readonly { path?: readonly PropertyKey[] }[] }) {
    return payload.issues.every((issue) => !["password", "confirmPassword"].includes(String(issue.path?.[0])));
  },
};

export const signUpSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string({ error: "Confirmez le mot de passe." }),
    displayName: displayNameSchema,
    country: countrySchema,
    phone: phoneSchema,
    acceptTerms: acceptTermsSchema,
  })
  .refine(passwordsMatch, passwordsMismatch);

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string({ error: "Mot de passe requis." }).min(1, { error: "Mot de passe requis." }),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const newPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string({ error: "Confirmez le mot de passe." }),
  })
  .refine(passwordsMatch, passwordsMismatch);

export const profileSchema = z.object({
  displayName: displayNameSchema,
  country: countrySchema,
  phone: phoneSchema,
  timezone: timezoneSchema,
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
