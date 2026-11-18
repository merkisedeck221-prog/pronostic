import type { Metadata } from "next";
import { AdminActionForm } from "@/components/admin/action-form";
import { AdminPage, Field, inputClass } from "@/components/admin/table-tools";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deletePriceOverrideAction, savePriceAction, setPricingModeAction } from "@/lib/admin/actions/pricing";
import { bundleWarning } from "@/lib/admin/settings";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Tarifs · Administration" };

const MODES = [
  { value: "per_market", label: "Par pronostic uniquement" },
  { value: "per_match", label: "Par match complet uniquement" },
  { value: "both", label: "Les deux" },
] as const;

export default async function AdminPricingPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: mode }, { data: markets }, { data: rules }, { data: competitions }] = await Promise.all([
    supabase.from("app_settings").select("value").eq("key", "pricing_mode").maybeSingle(),
    supabase.from("markets").select("code, label, is_active").order("sort_order"),
    supabase.from("pricing_rules").select("id, scope, market_code, competition_id, credits, is_active").order("id"),
    supabase.from("competitions").select("id, name").order("name"),
  ]);
  const currentMode = typeof mode?.value === "string" ? mode.value : "both";
  const general = (rules ?? []).filter((r) => r.competition_id === null);
  const overrides = (rules ?? []).filter((r) => r.competition_id !== null);
  const marketRule = (code: string) => general.find((r) => r.scope === "market" && r.market_code === code);
  const bundleRule = general.find((r) => r.scope === "match_bundle");
  const competitionName = new Map((competitions ?? []).map((c) => [c.id, c.name]));
  const marketLabel = new Map((markets ?? []).map((m) => [m.code, m.label]));
  const activeMarketPrices = (markets ?? [])
    .filter((m) => m.is_active)
    .map((m) => marketRule(m.code))
    .filter((r): r is NonNullable<typeof r> => Boolean(r?.is_active))
    .map((r) => r.credits);
  const warning = bundleWarning(bundleRule?.is_active ? bundleRule.credits : null, activeMarketPrices);

  return (
    <AdminPage title="Tarifs" description="Prix en crédits, appliqués côté serveur au moment du déblocage. Ordre : règle de la compétition, puis règle générale.">
      <Card>
        <CardHeader>
          <CardTitle>Mode de tarification</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminActionForm action={setPricingModeAction} submitLabel="Enregistrer" inline>
            <select name="mode" defaultValue={currentMode} className={inputClass} aria-label="Mode">
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </AdminActionForm>
        </CardContent>
      </Card>

      {warning ? (
        <p role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">
          {warning}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Prix généraux</CardTitle>
          <CardDescription>Un marché sans prix actif n&apos;est pas achetable.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(markets ?? []).map((m) => {
            const rule = marketRule(m.code);
            return (
              <AdminActionForm key={m.code} action={savePriceAction} hidden={{ scope: "market", market_code: m.code }} submitLabel="Enregistrer" variant="outline" inline>
                <span className="w-56 text-sm">
                  {m.label}
                  {!m.is_active ? <span className="text-xs text-muted-foreground"> (marché inactif)</span> : null}
                </span>
                <input name="credits" type="number" min={0} max={10000} required defaultValue={rule?.credits ?? ""} className={`${inputClass} w-24`} aria-label={`Prix ${m.label}`} />
                <select name="is_active" defaultValue={rule?.is_active === false ? "false" : "true"} className={inputClass} aria-label="Actif">
                  <option value="true">Actif</option>
                  <option value="false">Inactif</option>
                </select>
              </AdminActionForm>
            );
          })}
          <AdminActionForm action={savePriceAction} hidden={{ scope: "match_bundle" }} submitLabel="Enregistrer" variant="outline" inline>
            <span className="w-56 text-sm font-medium">Match complet</span>
            <input name="credits" type="number" min={0} max={10000} required defaultValue={bundleRule?.credits ?? ""} className={`${inputClass} w-24`} aria-label="Prix du match complet" />
            <select name="is_active" defaultValue={bundleRule?.is_active === false ? "false" : "true"} className={inputClass} aria-label="Actif">
              <option value="true">Actif</option>
              <option value="false">Inactif</option>
            </select>
          </AdminActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Surcharges par compétition</CardTitle>
          <CardDescription>Prioritaires sur les prix généraux pour les matchs de la compétition.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Compétition</TableHead>
                  <TableHead>Élément</TableHead>
                  <TableHead className="text-right">Prix</TableHead>
                  <TableHead>Actif</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {overrides.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Aucune surcharge.
                    </TableCell>
                  </TableRow>
                ) : null}
                {overrides.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{competitionName.get(r.competition_id!) ?? r.competition_id}</TableCell>
                    <TableCell>{r.scope === "match_bundle" ? "Match complet" : (marketLabel.get(r.market_code ?? "") ?? r.market_code)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.credits}</TableCell>
                    <TableCell>{r.is_active ? "Oui" : "Non"}</TableCell>
                    <TableCell>
                      <AdminActionForm action={deletePriceOverrideAction} hidden={{ id: r.id }} submitLabel="Supprimer" variant="ghost" confirmMessage="Supprimer cette surcharge ?" inline />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <AdminActionForm action={savePriceAction} submitLabel="Ajouter ou modifier" inline>
            <Field label="Compétition">
              <select name="competition_id" required className={inputClass}>
                {(competitions ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Élément">
              <select name="target" className={inputClass} defaultValue="match_bundle" required>
                <option value="match_bundle">Match complet</option>
                {(markets ?? []).map((m) => (
                  <option key={m.code} value={`market:${m.code}`}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Prix (crédits)">
              <input name="credits" type="number" min={0} max={10000} required className={`${inputClass} w-24`} />
            </Field>
          </AdminActionForm>
        </CardContent>
      </Card>
    </AdminPage>
  );
}
