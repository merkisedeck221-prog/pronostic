import { afterEach, describe, expect, it, vi } from "vitest";
import { siteUrl } from "./site";

describe("adresse publique du site (métadonnées)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("utilise NEXT_PUBLIC_APP_URL en priorité", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://pronex.app");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "pronostic.vercel.app");
    expect(siteUrl().origin).toBe("https://pronex.app");
  });

  it("à défaut, l'adresse de production Vercel", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "pronostic.vercel.app");
    expect(siteUrl().origin).toBe("https://pronostic.vercel.app");
  });

  it("ignore une adresse mal formée", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "pas une url");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(siteUrl().origin).toBe("http://localhost:3000");
  });
});
