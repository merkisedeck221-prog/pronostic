import { describe, expect, it } from "vitest";
import { validateForm } from "@/lib/forms";
import {
  forgotPasswordSchema,
  newPasswordSchema,
  profileSchema,
  signInSchema,
  signUpSchema,
} from "./schemas";

const validSignUp = {
  email: "  awa@example.com ",
  password: "motdepasse1",
  confirmPassword: "motdepasse1",
  displayName: " Awa ",
  country: "BJ",
  phone: "",
  acceptTerms: "on",
};

describe("signUpSchema", () => {
  it("accepte une inscription valide et nettoie les espaces", () => {
    const data = signUpSchema.parse(validSignUp);
    expect(data).toMatchObject({ email: "awa@example.com", displayName: "Awa", country: "BJ", acceptTerms: true });
    expect(data.phone).toBeUndefined();
  });

  it("exige un mot de passe d'au moins 8 caractères", () => {
    const result = signUpSchema.safeParse({ ...validSignUp, password: "court", confirmPassword: "court" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Le mot de passe doit contenir au moins 8 caractères.");
  });

  it("refuse deux mots de passe différents", () => {
    const result = signUpSchema.safeParse({ ...validSignUp, confirmPassword: "autrechose" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ path: ["confirmPassword"], message: "Les mots de passe ne correspondent pas." });
  });

  it("signale des mots de passe différents même si un autre champ est invalide", () => {
    const result = signUpSchema.safeParse({ ...validSignUp, email: "nope", confirmPassword: "autrechose" });
    const paths = result.error?.issues.map((issue) => issue.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["email", "confirmPassword"]));
  });

  it("exige la case 18 ans et CGU (RG-F1-1)", () => {
    const withoutTerms: Record<string, string> = { ...validSignUp };
    delete withoutTerms.acceptTerms;
    const result = signUpSchema.safeParse(withoutTerms);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ["acceptTerms"],
      message: "Vous devez avoir 18 ans ou plus et accepter les CGU.",
    });
  });

  it("refuse un pays hors liste et un e-mail invalide", () => {
    const result = signUpSchema.safeParse({ ...validSignUp, country: "ZZ", email: "pas-un-email" });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((issue) => issue.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["country", "email"]));
  });

  it("valide le téléphone facultatif", () => {
    expect(signUpSchema.safeParse({ ...validSignUp, phone: "+229 01 23 45 67" }).success).toBe(true);
    expect(signUpSchema.safeParse({ ...validSignUp, phone: "abc" }).success).toBe(false);
  });
});

describe("signInSchema et forgotPasswordSchema", () => {
  it("exigent un e-mail valide", () => {
    expect(signInSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
    expect(signInSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});

describe("newPasswordSchema", () => {
  it("exige 8 caractères et une confirmation identique", () => {
    expect(newPasswordSchema.safeParse({ password: "12345678", confirmPassword: "12345678" }).success).toBe(true);
    expect(newPasswordSchema.safeParse({ password: "12345678", confirmPassword: "12345679" }).success).toBe(false);
  });
});

describe("profileSchema", () => {
  it("accepte un fuseau de la liste et refuse les autres", () => {
    const base = { displayName: "Awa", country: "SN", phone: "", timezone: "Africa/Porto-Novo" };
    expect(profileSchema.safeParse(base).success).toBe(true);
    expect(profileSchema.safeParse({ ...base, timezone: "Mars/Olympus" }).success).toBe(false);
  });
});

describe("validateForm", () => {
  it("renvoie les erreurs par champ sans réexposer les mots de passe", () => {
    const outcome = validateForm(signUpSchema, { ...validSignUp, password: "court", confirmPassword: "court" });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.state.fieldErrors?.password).toEqual(["Le mot de passe doit contenir au moins 8 caractères."]);
    expect(outcome.state.values).not.toHaveProperty("password");
    expect(outcome.state.values).not.toHaveProperty("confirmPassword");
    expect(outcome.state.values?.email).toBe(validSignUp.email);
  });
});
