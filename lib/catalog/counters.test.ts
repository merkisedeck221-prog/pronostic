import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

describe("compteurs publics : jamais de chiffre inventé", async () => {
  const { publicCountersSchema } = await import("./counters");

  it("garde les valeurs réelles et les valeurs masquées (null)", () => {
    expect(publicCountersSchema.parse({ users: 120, won: null, analyses: 64 })).toEqual({ users: 120, won: null, analyses: 64 });
  });

  it("masque toute valeur illisible, négative ou décimale", () => {
    expect(publicCountersSchema.parse({ users: -3, won: 2.5, analyses: "50000" })).toEqual({ users: null, won: null, analyses: null });
  });
});
