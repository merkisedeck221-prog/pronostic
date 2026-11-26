import { describe, expect, it } from "vitest";
import { activityItems, goalItems } from "./counters";

describe("compteurs de la landing : uniquement des chiffres vrais", () => {
  it("n'affiche que les indicateurs d'activité réellement disponibles, avec « + »", () => {
    expect(activityItems({ users: null, won: null, analyses: null })).toEqual(
      [],
    );
    const items = activityItems({ users: 140, won: null, analyses: 75 });
    expect(items.map((i) => [i.key, i.value, i.prefix])).toEqual([
      ["users", 140, "+"],
      ["analyses", 75, "+"],
    ]);
  });

  it("objectifs : toujours libellés « Objectif », jamais présentés comme des résultats", () => {
    const items = goalItems();
    expect(items.map((i) => [i.value, i.prefix])).toEqual([
      [25000, "+"],
      [12500, "+"],
      [50000, "+"],
    ]);
    expect(items.every((i) => i.label.startsWith("Objectif : "))).toBe(true);
  });
});
