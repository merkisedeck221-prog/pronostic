import { describe, expect, it } from "vitest";
import { countAt, easeOutExpo } from "./count-up";

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

  it("accélère puis ralentit (ease-out)", () => {
    expect(easeOutExpo(0)).toBe(0);
    expect(easeOutExpo(1)).toBe(1);
    expect(easeOutExpo(0.25) - easeOutExpo(0)).toBeGreaterThan(easeOutExpo(1) - easeOutExpo(0.75));
  });
});
