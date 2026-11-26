import { describe, expect, it } from "vitest";
import { generationProgressSchema, progressView, VISUAL_STEPS } from "./stages";

describe("animation PRONEX AI : étapes liées au traitement réel", () => {
  it("propose exactement 7 étapes visuelles", () => {
    expect(VISUAL_STEPS).toHaveLength(7);
    expect(VISUAL_STEPS[6].title).toBe("Résultat final");
  });

  it("démarre sur l'initialisation, sans rien marquer comme terminé", () => {
    const view = progressView("reserved", null);
    expect(view.steps).toEqual(["active", "pending", "pending", "pending", "pending", "pending", "pending"]);
    expect(view.completed).toBe(0);
  });

  it("ne marque une étape terminée que lorsque le serveur est passé à la suivante", () => {
    const view = progressView("running", "ai");
    expect(view.steps).toEqual(["done", "done", "done", "active", "pending", "pending", "pending"]);
    expect(view.completed).toBe(3);
    expect(view.finished).toBe(false);
  });

  it("n'affiche le résultat final qu'au statut « succeeded »", () => {
    expect(progressView("running", "saving").steps[6]).toBe("pending");
    expect(progressView("running", "saving").completed).toBe(5);
    const done = progressView("succeeded", "saving");
    expect(done.finished).toBe(true);
    expect(done.completed).toBe(7);
    expect(done.steps.every((s) => s === "done")).toBe(true);
  });

  it("arrête la progression sur l'étape en échec", () => {
    const view = progressView("failed", "validating");
    expect(view.failed).toBe(true);
    expect(view.steps).toEqual(["done", "done", "done", "done", "failed", "pending", "pending"]);
    expect(view.completed).toBe(4);
  });

  it("présente honnêtement une analyse mutualisée (étapes non observables)", () => {
    const view = progressView("running", "waiting");
    expect(view.shared).toBe(true);
    expect(view.steps).toEqual(["done", "done", "shared", "shared", "shared", "shared", "pending"]);
    expect(view.completed).toBe(2);
  });

  it("valide la réponse de la route de suivi", () => {
    expect(generationProgressSchema.safeParse({ status: "running", stage: "context", marketCode: null }).success).toBe(true);
    expect(generationProgressSchema.safeParse({ status: "running", stage: "invented", marketCode: null }).success).toBe(false);
  });
});
