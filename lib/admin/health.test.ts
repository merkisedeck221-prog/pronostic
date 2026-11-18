import { describe, expect, it } from "vitest";
import { anomalyLink, isReportStale, parseAnomalies } from "./health";

describe("surveillance", () => {
  it("lit les anomalies et ignore un format inattendu", () => {
    expect(parseAnomalies([{ type: "low_quota", severity: "warning", count: 12, message: "Quota bas" }])).toHaveLength(1);
    expect(parseAnomalies("x")).toEqual([]);
    expect(parseAnomalies([{ type: "x" }])).toEqual([]);
  });

  it("liens vers la page utile", () => {
    expect(anomalyLink("balance_mismatch")?.href).toBe("/admin/transactions?controle=1");
    expect(anomalyLink("fixtures_without_prediction")?.href).toContain("pronostic=sans");
    expect(anomalyLink("inconnu")).toBeNull();
  });

  it("rapport périmé au-delà de 26 h (tâche quotidienne arrêtée)", () => {
    const now = new Date("2026-11-18T12:00:00Z");
    expect(isReportStale(null, now)).toBe(true);
    expect(isReportStale("2026-11-18T06:07:00Z", now)).toBe(false);
    expect(isReportStale("2026-11-17T08:00:00Z", now)).toBe(true);
  });
});
