/** Paramètres connus de app_settings : type de champ, description, validation. */

export type SettingKind = "boolean" | "integer" | "enum" | "list" | "json";

export type SettingDefinition = {
  key: string;
  label: string;
  description: string;
  kind: SettingKind;
  options?: readonly { value: string; label: string }[];
  min?: number;
  max?: number;
};

export const SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  { key: "maintenance_mode", label: "Mode maintenance", description: "Bloque les déblocages et les recharges, avec un message.", kind: "boolean" },
  { key: "welcome_credits", label: "Crédits de bienvenue", description: "Crédits offerts à l'inscription (0 = désactivé).", kind: "integer", min: 0, max: 1000 },
  { key: "prediction_window_hours", label: "Fenêtre de génération (heures)", description: "Délai avant le coup d'envoi à partir duquel le pronostic est généré.", kind: "integer", min: 1, max: 168 },
  { key: "refund_on_cancel", label: "Remboursement automatique", description: "Rembourse les matchs annulés ou reportés de plus de 48 h.", kind: "boolean" },
  { key: "reveal_after_match", label: "Pronostics publics après le match", description: "Rend visibles par tous les pronostics d'un match terminé (RG-F4-4).", kind: "boolean" },
  {
    key: "pricing_mode",
    label: "Mode de tarification",
    description: "Ce qui est proposé à l'utilisateur. Réglable aussi dans Tarifs.",
    kind: "enum",
    options: [
      { value: "per_market", label: "Par pronostic" },
      { value: "per_match", label: "Par match complet" },
      { value: "both", label: "Les deux" },
    ],
  },
];

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
