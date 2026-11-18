import { describe, expect, it } from "vitest";
import { assertNotProduction } from "./guard";

describe("garde-fou des tests d'intégration", () => {
  it("refuse la base de production", () => {
    expect(() => assertNotProduction("https://pgeytactmugqskdzsxnw.supabase.co")).toThrow(/PRODUCTION/);
  });
  it("accepte une autre base", () => {
    expect(() => assertNotProduction("https://autre-projet-dev.supabase.co")).not.toThrow();
    expect(() => assertNotProduction(undefined)).not.toThrow();
  });
});
