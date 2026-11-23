import { describe, expect, it } from "vitest";
import { isValidPeriod, localInputToUtc, optionalLocalDateTime, utcToLocalInput } from "./datetime";

describe("localInputToUtc (Porto-Novo = UTC+1, sans heure d'été)", () => {
  it("convertit l'heure de Porto-Novo en UTC", () => {
    expect(localInputToUtc("2026-12-01T20:00")).toBe("2026-12-01T19:00:00.000Z");
    expect(localInputToUtc("2026-07-01T00:30")).toBe("2026-06-30T23:30:00.000Z");
  });
  it("vide → null, mal formé → undefined", () => {
    expect(localInputToUtc("")).toBeNull();
    expect(localInputToUtc(null)).toBeNull();
    expect(localInputToUtc("  ")).toBeNull();
    for (const v of ["2026-12-01", "01/12/2026 20:00", "2026-13-45T99:99", 12, "2026-12-01T20:00Z"]) {
      expect(localInputToUtc(v)).toBeUndefined();
    }
  });
});

describe("utcToLocalInput", () => {
  it("aller-retour stable", () => {
    expect(utcToLocalInput("2026-12-01T19:00:00.000Z")).toBe("2026-12-01T20:00");
    expect(localInputToUtc(utcToLocalInput("2026-12-01T19:00:00.000Z"))).toBe("2026-12-01T19:00:00.000Z");
    expect(utcToLocalInput(null)).toBe("");
  });
});

describe("optionalLocalDateTime et isValidPeriod", () => {
  it("refuse une date invalide", () => {
    expect(optionalLocalDateTime.safeParse("n'importe quoi").success).toBe(false);
    expect(optionalLocalDateTime.parse("")).toBeNull();
  });
  it("fin après début", () => {
    expect(isValidPeriod(null, null)).toBe(true);
    expect(isValidPeriod("2026-12-01T19:00:00.000Z", null)).toBe(true);
    expect(isValidPeriod("2026-12-01T19:00:00.000Z", "2026-12-02T19:00:00.000Z")).toBe(true);
    expect(isValidPeriod("2026-12-02T19:00:00.000Z", "2026-12-01T19:00:00.000Z")).toBe(false);
    expect(isValidPeriod("2026-12-01T19:00:00.000Z", "2026-12-01T19:00:00.000Z")).toBe(false);
  });
});
