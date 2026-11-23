import { describe, expect, it } from "vitest";
import { safeNotificationLink } from "@/lib/notifications/links";
import { matchesTransactionFilter, parseTransactionFilter, receiptNumber } from "./filters";

describe("parseTransactionFilter", () => {
  it("accepte les filtres connus", () => {
    expect(parseTransactionFilter("recus")).toBe("recus");
    expect(parseTransactionFilter("consommes")).toBe("consommes");
    expect(parseTransactionFilter("remboursements")).toBe("remboursements");
    expect(parseTransactionFilter(["remboursements", "x"])).toBe("remboursements");
  });
  it("retombe sur « tous » pour toute autre valeur", () => {
    for (const v of [undefined, "", "RECUS", "'; drop table x;--", 42, null, ["x"]]) {
      expect(parseTransactionFilter(v)).toBe("tous");
    }
  });
});

describe("matchesTransactionFilter", () => {
  const txs = [
    { type: "topup", amount: 28 },
    { type: "bonus", amount: 5 },
    { type: "admin_adjustment", amount: 3 },
    { type: "admin_adjustment", amount: -2 },
    { type: "unlock", amount: -7 },
    { type: "refund", amount: 7 },
  ];
  const sum = (f: Parameters<typeof matchesTransactionFilter>[0]) =>
    txs.filter((t) => matchesTransactionFilter(f, t)).reduce((s, t) => s + t.amount, 0);

  it("répartit chaque transaction dans une seule catégorie", () => {
    for (const t of txs) {
      const hits = (["recus", "consommes", "remboursements"] as const).filter((f) => matchesTransactionFilter(f, t));
      expect(hits).toHaveLength(1);
    }
  });
  it("totaux cohérents avec le résumé SQL (reçus, consommés, remboursés)", () => {
    expect(sum("recus")).toBe(36);
    expect(-sum("consommes")).toBe(9);
    expect(sum("remboursements")).toBe(7);
    expect(sum("tous")).toBe(36 - 9 + 7);
  });
});

describe("receiptNumber", () => {
  it("format stable RC-AAAAMMJJ-XXXXXXXX", () => {
    expect(receiptNumber("e2933565-0c4b-4921-a638-18ce5d62b091", "2026-11-23T18:28:03.161+00:00")).toBe(
      "RC-20261123-E2933565",
    );
  });
});

describe("safeNotificationLink", () => {
  it("garde les chemins internes", () => {
    expect(safeNotificationLink("/portefeuille?filtre=remboursements")).toBe("/portefeuille?filtre=remboursements");
  });
  it("refuse les liens externes ou ambigus", () => {
    for (const l of [null, "", "https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)"]) {
      expect(safeNotificationLink(l)).toBeNull();
    }
  });
});
