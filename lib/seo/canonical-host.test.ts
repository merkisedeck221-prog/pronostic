import { describe, expect, it } from "vitest";
import { canonicalRedirect } from "./canonical-host";

describe("canonicalRedirect", () => {
  it("redirige l'ancienne adresse vers pronex.vercel.app en gardant le chemin", () => {
    expect(canonicalRedirect("pronostic-brown.vercel.app", "/matchs", "?x=1")).toBe("https://pronex.vercel.app/matchs?x=1");
    expect(canonicalRedirect("PRONOSTIC-BROWN.vercel.app", "/", "")).toBe("https://pronex.vercel.app/");
  });
  it("ne redirige jamais les routes API ni le retour des e-mails", () => {
    expect(canonicalRedirect("pronostic-brown.vercel.app", "/api/cron/sync-fixtures", "")).toBeNull();
    expect(canonicalRedirect("pronostic-brown.vercel.app", "/api", "")).toBeNull();
    expect(canonicalRedirect("pronostic-brown.vercel.app", "/auth/callback", "?code=x")).toBeNull();
  });
  it("ne touche ni l'adresse officielle, ni les prévisualisations, ni le local", () => {
    expect(canonicalRedirect("pronex.vercel.app", "/", "")).toBeNull();
    expect(canonicalRedirect("pronostic-abc123-merkisedeck.vercel.app", "/", "")).toBeNull();
    expect(canonicalRedirect("localhost:3000", "/", "")).toBeNull();
    expect(canonicalRedirect(null, "/", "")).toBeNull();
  });
});
