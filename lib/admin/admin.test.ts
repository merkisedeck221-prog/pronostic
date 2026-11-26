import { describe, expect, it } from "vitest";
import { csvEscape, TOPUP_CSV_COLUMNS, TRANSACTION_CSV_COLUMNS, toCsv, type TransactionCsvRow } from "./csv";
import { fixturePeriodRange, pageCount, pageRange, parseEnumParam, parseIntParam, parsePageParam, periodStart, withParams } from "./params";
import { failure, isOk, sqlFailure } from "./result";
import { bundleWarning, isRetiredSetting, parseSettingInput, settingDefinition } from "./settings";

const tx: TransactionCsvRow = {
  id: 7,
  created_at: "2026-11-18T10:00:00.000Z",
  user_id: "00000000-0000-4000-8000-000000000001",
  display_name: "Awa",
  type: "unlock",
  amount: -2,
  balance_after: 8,
  description: "Déblocage : Arsenal – Chelsea, Score exact",
  reference_type: "fixture",
  reference_id: "12",
};

describe("export CSV", () => {
  it("colonnes des mouvements dans l'ordre attendu", () => {
    const csv = toCsv(TRANSACTION_CSV_COLUMNS, [tx]);
    expect(csv.startsWith("﻿")).toBe(true);
    const [header, line] = csv.slice(1).trimEnd().split("\r\n");
    expect(header.split(";")).toEqual([
      "id", "date_utc", "utilisateur_id", "utilisateur", "type", "montant", "solde_apres", "libelle", "reference_type", "reference_id",
    ]);
    expect(line.split(";")).toEqual([
      "7", "2026-11-18T10:00:00.000Z", tx.user_id, "Awa", "unlock", "-2", "8", "Déblocage : Arsenal – Chelsea, Score exact", "fixture", "12",
    ]);
  });

  it("colonnes des recharges", () => {
    const header = toCsv(TOPUP_CSV_COLUMNS, []).slice(1).trimEnd();
    expect(header.split(";")).toEqual([
      "id", "date_utc", "utilisateur_id", "utilisateur", "pack", "credits", "credits_verses", "montant_xof", "fournisseur", "reference", "statut", "termine_le_utc",
    ]);
  });

  it("échappement : séparateur, guillemets, retours à la ligne, valeurs vides, injection de formule", () => {
    expect(csvEscape('a;b "c"')).toBe('"a;b ""c"""');
    expect(csvEscape("ligne\nsuivante")).toBe('"ligne\nsuivante"');
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(-2)).toBe("-2");
    expect(csvEscape("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvEscape("+33 6")).toBe("'+33 6");
  });
});

describe("paramètres d'URL", () => {
  it("page, énumération, entier", () => {
    expect(parsePageParam("3")).toBe(3);
    expect(parsePageParam(["2"])).toBe(2);
    expect(parsePageParam("x")).toBe(1);
    expect(parsePageParam("0")).toBe(1);
    expect(parseEnumParam("b", ["a", "b"] as const, "a")).toBe("b");
    expect(parseEnumParam("z", ["a", "b"] as const, "a")).toBe("a");
    expect(parseIntParam("42")).toBe(42);
    expect(parseIntParam("4x")).toBeNull();
  });

  it("pagination et liens", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(26)).toBe(2);
    expect(pageRange(2)).toEqual({ from: 25, to: 49 });
    expect(withParams("/admin/matchs", { statut: "termine", page: "3" }, { page: null, tri: "date_desc" })).toBe("/admin/matchs?statut=termine&tri=date_desc");
    expect(withParams("/x", {}, {})).toBe("/x");
  });

  it("périodes", () => {
    const now = new Date("2026-11-18T12:00:00Z");
    expect(periodStart("7j", now)?.toISOString()).toBe("2026-11-11T12:00:00.000Z");
    expect(periodStart("tout", now)).toBeNull();
    expect(fixturePeriodRange("48h", now).to?.toISOString()).toBe("2026-11-20T12:00:00.000Z");
    expect(fixturePeriodRange("passes-7j", now).from?.toISOString()).toBe("2026-11-11T12:00:00.000Z");
    expect(fixturePeriodRange("tout", now)).toEqual({ from: null, to: null });
  });
});

describe("paramètres de l'application", () => {
  it("crédits de bienvenue retirés (packs fixes, aucun crédit gratuit)", () => {
    expect(isRetiredSetting("welcome_credits")).toBe(true);
    expect(isRetiredSetting("maintenance_mode")).toBe(false);
  });

  it("convertit et valide chaque type de champ", () => {
    expect(parseSettingInput(settingDefinition("maintenance_mode"), "true")).toEqual({ ok: true, value: true });
    expect(parseSettingInput(settingDefinition("maintenance_mode"), "false")).toEqual({ ok: true, value: false });
    expect(parseSettingInput(settingDefinition("fixtures_window_days"), "5")).toEqual({ ok: true, value: 5 });
    expect(parseSettingInput(settingDefinition("fixtures_window_days"), "-1")).toMatchObject({ ok: false });
    expect(parseSettingInput(settingDefinition("prediction_window_hours"), "2,5")).toMatchObject({ ok: false });
    expect(parseSettingInput(settingDefinition("pricing_mode"), "both")).toEqual({ ok: true, value: "both" });
    expect(parseSettingInput(settingDefinition("pricing_mode"), "free")).toMatchObject({ ok: false });
    expect(parseSettingInput(settingDefinition("cle_inconnue"), '{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
    expect(parseSettingInput(settingDefinition("cle_inconnue"), "{a")).toMatchObject({ ok: false });
    expect(parseSettingInput({ key: "l", label: "l", description: "", kind: "list" }, "a, b,,c")).toEqual({ ok: true, value: ["a", "b", "c"] });
  });

  it("avertit si le match complet coûte plus que la somme des marchés", () => {
    expect(bundleWarning(10, [2, 2, 2, 3])).toMatch(/plus cher/);
    expect(bundleWarning(7, [2, 2, 2, 3])).toBeNull();
    expect(bundleWarning(null, [2])).toBeNull();
  });
});

describe("résultats des actions", () => {
  it("messages des refus SQL", () => {
    expect(sqlFailure({ ok: false, code: "FORBIDDEN" })).toEqual(failure("Action réservée aux administrateurs."));
    expect(sqlFailure({ ok: false, code: "INVALID_INPUT", message: "Un motif est obligatoire." })).toEqual(failure("Un motif est obligatoire."));
    expect(sqlFailure({ ok: false, code: "SELF" })).toEqual(failure("Action refusée. (SELF)"));
    expect(isOk({ ok: true })).toBe(true);
    expect(isOk(null)).toBe(false);
  });
});

describe("date de lancement des statistiques (stats_since)", () => {
  it("convertit l'heure de Porto-Novo (UTC+1) en ISO UTC, et retour", async () => {
    const { isoToPortoNovoInput, portoNovoInputToIso } = await import("./settings");
    expect(portoNovoInputToIso("2026-11-26T14:30")).toBe("2026-11-26T13:30:00.000Z");
    expect(portoNovoInputToIso("2026-12-01T00:30")).toBe("2026-11-30T23:30:00.000Z");
    expect(isoToPortoNovoInput("2026-11-26T13:30:00.000Z")).toBe("2026-11-26T14:30");
    expect(isoToPortoNovoInput(null)).toBe("");
    expect(isoToPortoNovoInput("n'importe quoi")).toBe("");
  });

  it("valide la saisie : vide = tout compter, date impossible refusée", () => {
    const def = settingDefinition("stats_since");
    expect(def.kind).toBe("datetime");
    expect(parseSettingInput(def, "")).toEqual({ ok: true, value: null });
    expect(parseSettingInput(def, "2026-11-26T14:30")).toEqual({ ok: true, value: "2026-11-26T13:30:00.000Z" });
    expect(parseSettingInput(def, "2026-02-30T10:00")).toMatchObject({ ok: false });
    expect(parseSettingInput(def, "26/11/2026")).toMatchObject({ ok: false });
  });
});
