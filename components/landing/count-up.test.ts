import { describe, expect, it } from "vitest";
import { countAt, easeInOutCubic } from "./count-up";

describe("compteur animé (Count Up)", () => {
  it("part de zéro et arrive exactement sur la valeur réelle", () => {
    expect(countAt(1234, 0)).toBe(0);
    expect(countAt(1234, 1)).toBe(1234);
    expect(countAt(1234, 5)).toBe(1234);
  });

  it("progresse sans jamais dépasser ni reculer", () => {
    let previous = 0;
    for (let i = 0; i <= 100; i++) {
      const v = countAt(987, i / 100);
      expect(v).toBeGreaterThanOrEqual(previous);
      expect(v).toBeLessThanOrEqual(987);
      previous = v;
    }
  });

  it("démarre en douceur, accélère, puis ralentit avant la valeur finale", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    const start = easeInOutCubic(0.1) - easeInOutCubic(0);
    const middle = easeInOutCubic(0.55) - easeInOutCubic(0.45);
    const end = easeInOutCubic(1) - easeInOutCubic(0.9);
    expect(middle).toBeGreaterThan(start);
    expect(middle).toBeGreaterThan(end);
  });
});
