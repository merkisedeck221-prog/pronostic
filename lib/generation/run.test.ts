import { describe, expect, it, vi } from "vitest";
import { runGeneration, WAIT_MAX_STEPS, type GenerationDeps } from "./run";

function deps(over: Partial<GenerationDeps> = {}) {
  const calls = { complete: 0, fail: [] as string[], generate: 0 };
  const d: GenerationDeps = {
    start: vi.fn(async () => ({ ok: true, action: "generate", status: "running", fixture_id: 7 })),
    complete: vi.fn(async () => {
      calls.complete++;
      return { ok: true, status: "succeeded" };
    }),
    fail: vi.fn(async (_id: string, error: string) => {
      calls.fail.push(error);
      return { ok: true, status: "failed" };
    }),
    hasResult: vi.fn(async () => false),
    dailyLimitReached: vi.fn(async () => false),
    generate: vi.fn(async () => {
      calls.generate++;
      return { ok: true as const };
    }),
    sleep: vi.fn(async () => {}),
    ...over,
  };
  return { d, calls };
}

describe("runGeneration", () => {
  it("génère puis valide la demande (accès + débit définitif)", async () => {
    const { d, calls } = deps();
    expect(await runGeneration(d, "r1")).toEqual({ status: "succeeded" });
    expect(calls.generate).toBe(1);
    expect(calls.complete).toBe(1);
    expect(calls.fail).toEqual([]);
  });

  it("échec de l'IA : crédits rendus, jamais validée", async () => {
    const { d, calls } = deps({ generate: vi.fn(async () => ({ ok: false as const, error: "OpenAI : délai dépassé" })) });
    const out = await runGeneration(d, "r1");
    expect(out.status).toBe("failed");
    expect(calls.fail).toEqual(["OpenAI : délai dépassé"]);
    expect(calls.complete).toBe(0);
  });

  it("résultat déjà existant : aucun appel à l'IA (mutualisation)", async () => {
    const { d, calls } = deps({ hasResult: vi.fn(async () => true) });
    expect(await runGeneration(d, "r1")).toEqual({ status: "succeeded" });
    expect(calls.generate).toBe(0);
  });

  it("course : un autre traitement a enregistré entre-temps → validée sans nouvel appel", async () => {
    const { d, calls } = deps({ generate: vi.fn(async () => ({ ok: false as const, error: "already_has_predictions", alreadyGenerated: true })) });
    expect(await runGeneration(d, "r1")).toEqual({ status: "succeeded" });
    expect(calls.fail).toEqual([]);
  });

  it("limite quotidienne atteinte : crédits rendus, IA non appelée", async () => {
    const { d, calls } = deps({ dailyLimitReached: vi.fn(async () => true) });
    const out = await runGeneration(d, "r1");
    expect(out.status).toBe("failed");
    expect(calls.generate).toBe(0);
    expect(calls.fail).toHaveLength(1);
  });

  it("attente d'une génération en cours puis résultat mutualisé", async () => {
    let n = 0;
    const { d, calls } = deps({
      start: vi.fn(async () => ({ ok: true, action: "wait", status: "reserved", fixture_id: 7 })),
      hasResult: vi.fn(async () => ++n >= 3),
    });
    expect(await runGeneration(d, "r1")).toEqual({ status: "succeeded" });
    expect(calls.generate).toBe(0);
    expect(d.sleep).toHaveBeenCalledTimes(2);
  });

  it("attente trop longue : reste en cours (le filet de sécurité terminera)", async () => {
    const { d, calls } = deps({ start: vi.fn(async () => ({ ok: true, action: "wait", status: "reserved", fixture_id: 7 })) });
    const out = await runGeneration(d, "r1");
    expect(out.status).toBe("pending");
    expect(d.sleep).toHaveBeenCalledTimes(WAIT_MAX_STEPS + 1);
    expect(calls.fail).toEqual([]);
  });

  it("demande déjà terminée : pas de nouveau traitement", async () => {
    const { d, calls } = deps({ start: vi.fn(async () => ({ ok: true, action: "none", status: "succeeded" })) });
    expect(await runGeneration(d, "r1")).toEqual({ status: "succeeded" });
    expect(calls.generate + calls.complete).toBe(0);
  });

  it("erreur inattendue : crédits rendus", async () => {
    const { d, calls } = deps({ generate: vi.fn(async () => { throw new Error("réseau coupé"); }) });
    const out = await runGeneration(d, "r1");
    expect(out.status).toBe("failed");
    expect(calls.fail[0]).toContain("réseau coupé");
  });

  it("réponse SQL invalide : échec propre", async () => {
    const { d } = deps({ start: vi.fn(async () => ({ ok: false, code: "NOT_FOUND" })) });
    expect((await runGeneration(d, "r1")).status).toBe("failed");
  });
});
