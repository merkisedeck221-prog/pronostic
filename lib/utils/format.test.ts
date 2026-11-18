import { describe, expect, it } from "vitest";
import { formatCredits, formatXof } from "./format";

const normalize = (value: string) => value.replace(/\s/g, " ");

describe("formatCredits", () => {
  it("accorde au singulier et au pluriel", () => {
    expect(formatCredits(0)).toBe("0 crédit");
    expect(formatCredits(1)).toBe("1 crédit");
    expect(formatCredits(25)).toBe("25 crédits");
  });
});

describe("formatXof", () => {
  it("sépare les milliers", () => {
    expect(normalize(formatXof(2500))).toBe("2 500 FCFA");
  });
});
