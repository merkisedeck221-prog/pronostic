import { describe, expect, it } from "vitest";
import { activityItems, productItems } from "./counters";

describe("compteurs de la landing : uniquement des chiffres vrais", () => {
  it("n'affiche que les indicateurs d'activité réellement disponibles, avec « + »", () => {
    expect(activityItems({ users: null, won: null, analyses: null })).toEqual([]);
    const items = activityItems({ users: 140, won: null, analyses: 75 });
    expect(items.map((i) => [i.key, i.value, i.prefix])).toEqual([
      ["users", 140, "+"],
      ["analyses", 75, "+"],
    ]);
  });

  it("chiffres du produit : valeurs exactes, sans « + », jamais d'exemple", () => {
    const items = productItems({ markets: 13, competitions: 5, steps: 7 });
    expect(items.map((i) => [i.key, i.value, i.prefix])).toEqual([
      ["markets", 13, undefined],
      ["competitions", 5, undefined],
      ["steps", 7, undefined],
    ]);
    expect(productItems({ markets: 0, competitions: 0, steps: 0 })).toEqual([]);
  });
});
