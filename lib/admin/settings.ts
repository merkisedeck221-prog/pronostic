/** Paramètres connus de app_settings : type de champ, description, validation. */

export type SettingKind = "boolean" | "integer" | "enum" | "list" | "json" | "datetime";

export type SettingGroup = "general" | "ia" | "competitions" | "synchronisation" | "paiement";

export const SETTING_GROUPS: readonly { id: SettingGroup; title: string; description: string }[] = [
  { id: "general", title: "Paramètres généraux", description: "Maintenance, visibilité des pronostics, remboursements, tarification." },
  { id: "ia", title: "Paramètres de l'IA", description: "Quand les pronostics sont générés, automatiquement ou à la demande." },
  { id: "competitions", title: "Compétitions et matchs", description: "Affichage des matchs. Activation, saison et ordre des compétitions : page Compétitions." },
  { id: "synchronisation", title: "Synchronisation", description: "Seuils de surveillance d'API-Football. Lancements et historique : page Synchronisation." },
  { id: "paiement", title: "Paiement", description: "Moyens de paiement proposés (paiement simulé pour le moment). Page dédiée : Moyens de paiement." },
];

export type SettingDefinition = {
  key: string;
  group?: SettingGroup;
  label: string;
  description: string;
  kind: SettingKind;
  options?: readonly { value: string; label: string }[];
  min?: number;
  max?: number;
};

/**
 * Paramètres retirés (packs fixes PRONEX, aucun crédit gratuit) : conservés en
 * base pour l'historique, ni affichés ni modifiables, ignorés par le SQL.
 */
export const RETIRED_SETTINGS: readonly string[] = ["welcome_credits"];

export function isRetiredSetting(key: string): boolean {
  return RETIRED_SETTINGS.includes(key);
}

export const SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  { key: "maintenance_mode", group: "general", label: "Mode maintenance", description: "Bloque les déblocages et les recharges, avec un message.", kind: "boolean" },
  { key: "prediction_window_hours", group: "ia", label: "Fenêtre de génération (heures)", description: "Délai avant le coup d'envoi à partir duquel le pronostic est généré.", kind: "integer", min: 1, max: 168 },
  { key: "fixtures_window_days", group: "competitions", label: "Fenêtre des matchs (jours)", description: "Période affichée par défaut sur la page Matchs (RG-F2-4).", kind: "integer", min: 1, max: 14 },
  { key: "refund_on_cancel", group: "general", label: "Remboursement automatique", description: "Rembourse les matchs annulés ou reportés de plus de 48 h.", kind: "boolean" },
  {
    key: "stats_since",
    group: "general",
    label: "Date de lancement des statistiques",
    description: "Les ventes et les totaux du portefeuille sont comptés à partir de cette date (heure de Porto-Novo). Les mouvements antérieurs restent consultables. Vide : tout compter.",
    kind: "datetime",
  },
  { key: "counters_min_users", group: "general", label: "Compteur « utilisateurs » : seuil d'affichage", description: "La page d'accueil affiche le nombre réel d'utilisateurs inscrits à partir de ce nombre (en dessous, l'indicateur est masqué).", kind: "integer", min: 1, max: 100000000 },
  { key: "counters_min_won", group: "general", label: "Compteur « pronostics gagnants » : seuil d'affichage", description: "Nombre réel de pronostics publiés et gagnés, affiché à partir de ce nombre.", kind: "integer", min: 1, max: 100000000 },
  { key: "counters_min_analyses", group: "general", label: "Compteur « analyses IA » : seuil d'affichage", description: "Nombre réel d'analyses PRONEX AI terminées et validées, affiché à partir de ce nombre.", kind: "integer", min: 1, max: 100000000 },
  { key: "reveal_after_match", group: "general", label: "Pronostics publics après le match", description: "Rend visibles par tous les pronostics d'un match terminé (RG-F4-4).", kind: "boolean" },
  {
    key: "pricing_mode",
    group: "general",
    label: "Mode de tarification",
    description: "Ce qui est proposé à l'utilisateur. Réglable aussi dans Tarifs.",
    kind: "enum",
    options: [
      { value: "per_market", label: "Par pronostic" },
      { value: "per_match", label: "Par match complet" },
      { value: "both", label: "Les deux" },
    ],
  },
  { key: "on_demand_generation_enabled", group: "ia", label: "Analyse IA à la demande", description: "Propose aux utilisateurs de demander une analyse (crédits réservés, débités seulement si elle réussit).", kind: "boolean" },
  { key: "on_demand_window_hours", group: "ia", label: "Délai maximal des demandes (heures)", description: "Délai avant le coup d'envoi pendant lequel une analyse peut être demandée.", kind: "integer", min: 1, max: 720 },
  { key: "alert_quota_min", group: "synchronisation", label: "Seuil d'alerte du quota API-Football", description: "Alerte de la surveillance quotidienne si le quota restant passe sous ce seuil.", kind: "integer", min: 0, max: 100000 },
  { key: "payment_methods", group: "paiement", label: "Moyens de paiement", description: "Réglage technique (JSON) ; préférez la page Moyens de paiement.", kind: "json" },
];

/** Groupe d'affichage d'un paramètre (« général » pour un paramètre inconnu). */
export function settingGroup(key: string): SettingGroup {
  return SETTING_DEFINITIONS.find((d) => d.key === key)?.group ?? "general";
}

export function settingDefinition(key: string): SettingDefinition {
  return (
    SETTING_DEFINITIONS.find((d) => d.key === key) ?? {
      key,
      label: key,
      description: "Paramètre sans description (valeur JSON).",
      kind: "json",
    }
  );
}

export type ParsedSetting = { ok: true; value: unknown } | { ok: false; error: string };

/** Convertit la valeur saisie dans le formulaire en valeur JSON validée. */
export function parseSettingInput(definition: SettingDefinition, raw: string | null): ParsedSetting {
  const text = (raw ?? "").trim();
  switch (definition.kind) {
    case "boolean":
      return { ok: true, value: text === "true" || text === "on" };
    case "integer": {
      if (!/^-?\d{1,9}$/.test(text)) return { ok: false, error: "Nombre entier attendu." };
      const value = Number(text);
      if (definition.min !== undefined && value < definition.min) return { ok: false, error: `Minimum : ${definition.min}.` };
      if (definition.max !== undefined && value > definition.max) return { ok: false, error: `Maximum : ${definition.max}.` };
      return { ok: true, value };
    }
    case "enum":
      return definition.options?.some((o) => o.value === text) ? { ok: true, value: text } : { ok: false, error: "Valeur non autorisée." };
    case "list":
      return { ok: true, value: text.split(",").map((s) => s.trim()).filter(Boolean) };
    case "datetime": {
      if (text === "") return { ok: true, value: null };
      const iso = portoNovoInputToIso(text);
      return iso ? { ok: true, value: iso } : { ok: false, error: "Date et heure attendues (AAAA-MM-JJ HH:MM)." };
    }
    default:
      try {
        return { ok: true, value: JSON.parse(text) };
      } catch {
        return { ok: false, error: "JSON invalide." };
      }
  }
}

/** Avertissement : match complet plus cher que la somme des marchés. */
export function bundleWarning(bundlePrice: number | null, marketPrices: number[]): string | null {
  if (bundlePrice === null || marketPrices.length === 0) return null;
  const sum = marketPrices.reduce((a, b) => a + b, 0);
  return bundlePrice > sum
    ? `Le match complet (${bundlePrice} crédits) coûte plus cher que la somme des marchés (${sum} crédits).`
    : null;
}

/** Porto-Novo (Bénin) : UTC+1 toute l'année, sans heure d'été. */
const PORTO_NOVO_OFFSET_MS = 60 * 60 * 1000;

/** « 2026-11-26T14:30 » (heure de Porto-Novo, champ datetime-local) → ISO UTC, ou null si invalide. */
export function portoNovoInputToIso(text: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1).map(Number);
  const utc = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(utc);
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59) return null;
  return new Date(utc - PORTO_NOVO_OFFSET_MS).toISOString();
}

/** Valeur stockée (ISO) → valeur du champ datetime-local à l'heure de Porto-Novo ; "" si vide ou illisible. */
export function isoToPortoNovoInput(value: unknown): string {
  if (typeof value !== "string") return "";
  const time = Date.parse(value);
  if (Number.isNaN(time)) return "";
  return new Date(time + PORTO_NOVO_OFFSET_MS).toISOString().slice(0, 16);
}
