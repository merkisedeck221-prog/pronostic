import { describe, expect, it } from "vitest";
import { isCancelledOrPostponed, isFinished, isLive, isUpcoming, matchStatus } from "./match-status";

describe("matchStatus", () => {
  it.each([
    ["NS", "À venir", "upcoming"],
    ["TBD", "Horaire à confirmer", "upcoming"],
    ["1H", "1re mi-temps", "live"],
    ["HT", "Mi-temps", "live"],
    ["2H", "2e mi-temps", "live"],
    ["ET", "Prolongations", "live"],
    ["P", "Tirs au but", "live"],
    ["SUSP", "Suspendu", "live"],
    ["FT", "Terminé", "finished"],
    ["AET", "Terminé après prolongations", "finished"],
    ["PEN", "Terminé aux tirs au but", "finished"],
    ["PST", "Reporté", "cancelled"],
    ["CANC", "Annulé", "cancelled"],
    ["ABD", "Abandonné", "cancelled"],
  ])("%s → %s (%s)", (code, label, phase) => {
    expect(matchStatus(code)).toEqual({ code, label, phase });
  });

  it("statut inconnu ou absent", () => {
    expect(matchStatus("XYZ")).toEqual({ code: "XYZ", label: "XYZ", phase: "upcoming" });
    expect(matchStatus(null).code).toBe("NS");
  });

  it("raccourcis", () => {
    expect(isFinished("PEN")).toBe(true);
    expect(isLive("HT")).toBe(true);
    expect(isCancelledOrPostponed("PST")).toBe(true);
    expect(isUpcoming("NS")).toBe(true);
    expect(isFinished("NS")).toBe(false);
  });
});
