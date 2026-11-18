import { describe, expect, it } from "vitest";
import {
  dayHeading,
  dayKey,
  formatDateTime,
  formatKickoff,
  groupByDay,
  parsePeriod,
  periodRange,
  clampWindowDays,
  periodOptions,
  relativeDayLabel,
  resolveTimezone,
} from "./dates";

const PORTO_NOVO = "Africa/Porto-Novo"; // UTC+1, sans heure d'été
const PARIS = "Europe/Paris";

describe("formats français", () => {
  it("affiche « sam. 22 nov. à 16:00 » dans le fuseau de l'utilisateur", () => {
    // 15:00 UTC = 16:00 à Porto-Novo
    expect(formatDateTime("2026-11-22T15:00:00Z", PORTO_NOVO)).toBe("dim. 22 nov. à 16:00");
    expect(formatDateTime("2026-11-21T15:00:00Z", PORTO_NOVO)).toBe("sam. 21 nov. à 16:00");
  });

  it("change de jour quand le fuseau franchit minuit", () => {
    // 23:30 UTC le 21 = 00:30 le 22 à Porto-Novo
    expect(dayKey("2026-11-21T23:30:00Z", PORTO_NOVO)).toBe("2026-11-22");
    expect(dayKey("2026-11-21T23:30:00Z", "UTC")).toBe("2026-11-21");
    expect(formatDateTime("2026-11-21T23:30:00Z", PORTO_NOVO)).toBe("dim. 22 nov. à 00:30");
  });

  it("gère l'heure d'été européenne", () => {
    expect(formatDateTime("2026-07-04T18:00:00Z", PARIS)).toBe("sam. 4 juil. à 20:00"); // UTC+2
    expect(formatDateTime("2026-12-05T18:00:00Z", PARIS)).toBe("sam. 5 déc. à 19:00"); // UTC+1
  });
});

describe("libellés relatifs", () => {
  const now = new Date("2026-11-21T22:30:00Z"); // 23:30 le samedi 21 à Porto-Novo

  it("Aujourd'hui / Demain / Hier selon le calendrier de l'utilisateur", () => {
    expect(relativeDayLabel("2026-11-21T20:00:00Z", PORTO_NOVO, now)).toBe("Aujourd'hui");
    // 23:15 UTC le 21 = 00:15 le 22 à Porto-Novo : « Demain », alors que c'est le même jour en UTC
    expect(relativeDayLabel("2026-11-21T23:15:00Z", PORTO_NOVO, now)).toBe("Demain");
    expect(relativeDayLabel("2026-11-21T23:15:00Z", "UTC", now)).toBe("Aujourd'hui");
    expect(relativeDayLabel("2026-11-20T12:00:00Z", PORTO_NOVO, now)).toBe("Hier");
    expect(relativeDayLabel("2026-11-25T12:00:00Z", PORTO_NOVO, now)).toBeNull();
  });

  it("formatKickoff et dayHeading", () => {
    expect(formatKickoff("2026-11-22T15:00:00Z", PORTO_NOVO, now)).toBe("Demain à 16:00");
    expect(formatKickoff("2026-11-28T15:00:00Z", PORTO_NOVO, now)).toBe("sam. 28 nov. à 16:00");
    expect(dayHeading("2026-11-21T20:00:00Z", PORTO_NOVO, now)).toBe("Aujourd'hui · sam. 21 nov.");
  });
});

describe("périodes de /matchs", () => {
  const now = new Date("2026-11-21T22:30:00Z"); // 23:30 à Porto-Novo

  it("aujourd'hui : minuit à minuit dans le fuseau", () => {
    const { from, to } = periodRange("aujourdhui", PORTO_NOVO, now);
    expect(from.toISOString()).toBe("2026-11-20T23:00:00.000Z");
    expect(to.toISOString()).toBe("2026-11-21T23:00:00.000Z");
  });

  it("demain : journée suivante entière", () => {
    const { from, to } = periodRange("demain", PORTO_NOVO, now);
    expect(from.toISOString()).toBe("2026-11-21T23:00:00.000Z");
    expect(to.toISOString()).toBe("2026-11-22T23:00:00.000Z");
  });

  it("7 jours : de maintenant à la fin du 7e jour", () => {
    const { from, to } = periodRange("7-jours", PORTO_NOVO, now);
    expect(from).toEqual(now);
    expect(to.toISOString()).toBe("2026-11-28T23:00:00.000Z");
  });

  it("fenêtre paramétrable (RG-F2-4) : 3 jours, valeurs invalides → 7", () => {
    const { to } = periodRange("7-jours", PORTO_NOVO, now, 3);
    const { to: to7 } = periodRange("7-jours", PORTO_NOVO, now, 99);
    expect(to.getTime()).toBeLessThan(to7.getTime());
    expect(to7.getTime()).toBe(periodRange("7-jours", PORTO_NOVO, now).to.getTime());
    expect(clampWindowDays("10")).toBe(10);
    expect(clampWindowDays(0)).toBe(7);
    expect(periodOptions(10).find((p) => p.value === "7-jours")?.label).toBe("10 jours");
  });

  it("valeur inconnue → 7 jours", () => {
    expect(parsePeriod("n'importe quoi")).toBe("7-jours");
    expect(parsePeriod("demain")).toBe("demain");
  });
});

describe("utilitaires", () => {
  it("resolveTimezone retombe sur Africa/Porto-Novo si le fuseau est invalide", () => {
    expect(resolveTimezone("Europe/Paris")).toBe("Europe/Paris");
    expect(resolveTimezone("Mars/Olympus")).toBe("Africa/Porto-Novo");
    expect(resolveTimezone(null)).toBe("Africa/Porto-Novo");
  });

  it("groupByDay regroupe dans le fuseau de l'utilisateur", () => {
    const items = ["2026-11-21T20:00:00Z", "2026-11-21T23:30:00Z", "2026-11-22T10:00:00Z"];
    const groups = groupByDay(items, (d) => d, PORTO_NOVO);
    expect(groups.map((g) => [g.key, g.items.length])).toEqual([
      ["2026-11-21", 1],
      ["2026-11-22", 2],
    ]);
  });
});
