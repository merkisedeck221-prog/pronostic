import { describe, expect, it } from "vitest";
import { parseClientEnv, parseServerEnv } from "./env";

const validServer = {
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  API_FOOTBALL_KEY: "api-football-key",
  OPENAI_API_KEY: "openai-key",
  OPENAI_MODEL: "some-model",
  CRON_SECRET: "x".repeat(32),
};

describe("parseClientEnv", () => {
  it("accepte des variables valides et applique le fuseau par défaut", () => {
    const env = parseClientEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    });
    expect(env.DEFAULT_TIMEZONE).toBe("Africa/Porto-Novo");
  });

  it("traite une chaîne vide comme absente et donne un message clair", () => {
    expect(() =>
      parseClientEnv({
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});

describe("parseServerEnv", () => {
  it("applique les valeurs par défaut", () => {
    const env = parseServerEnv(validServer);
    expect(env.API_FOOTBALL_DAILY_BUDGET).toBe(90);
    expect(env.AI_DAILY_GENERATION_LIMIT).toBe(20);
    expect(env.PAYMENT_PROVIDER).toBe("mock");
    expect(env.ADMIN_EMAILS).toEqual([]);
  });

  it("découpe et normalise ADMIN_EMAILS", () => {
    const env = parseServerEnv({ ...validServer, ADMIN_EMAILS: " A@x.com, b@y.org ," });
    expect(env.ADMIN_EMAILS).toEqual(["a@x.com", "b@y.org"]);
  });

  it("liste toutes les variables obligatoires manquantes", () => {
    try {
      parseServerEnv({});
      expect.unreachable();
    } catch (error) {
      const message = (error as Error).message;
      for (const key of ["SUPABASE_SERVICE_ROLE_KEY", "API_FOOTBALL_KEY", "OPENAI_API_KEY", "CRON_SECRET"]) {
        expect(message).toContain(key);
      }
    }
  });

  it("refuse un CRON_SECRET trop court", () => {
    expect(() => parseServerEnv({ ...validServer, CRON_SECRET: "court" })).toThrow(/CRON_SECRET/);
  });
});
