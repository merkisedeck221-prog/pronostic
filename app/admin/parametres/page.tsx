import type { Metadata } from "next";
import { AdminActionForm } from "@/components/admin/action-form";
import { AdminPage, inputClass } from "@/components/admin/table-tools";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { saveSettingAction, setMarketActiveAction } from "@/lib/admin/actions/settings";
import { isoToPortoNovoInput, isRetiredSetting, SETTING_GROUPS, settingDefinition, settingGroup } from "@/lib/admin/settings";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Paramètres · Administration" };

const GROUP_LINKS: Partial<Record<string, { href: string; label: string }>> = {
  competitions: { href: "/admin/competitions", label: "Gérer les compétitions" },
  synchronisation: { href: "/admin/synchronisation", label: "Voir les tâches automatiques" },
  paiement: { href: "/admin/paiements", label: "Gérer les moyens de paiement" },
  ia: { href: "/admin/ia", label: "Voir le suivi de l'IA" },
};

export default async function AdminSettingsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: settings, error }, { data: markets }] = await Promise.all([
    supabase.from("app_settings").select("key, value, description, is_public").order("key"),
    supabase.from("markets").select("code, label, description, is_active").order("sort_order"),
  ]);
  if (error) throw new Error(error.message);

  return (
    <AdminPage title="Paramètres" description="Réglages de l'application, appliqués sans redéploiement. Chaque modification est enregistrée dans le journal d'audit.">
      {SETTING_GROUPS.map((group) => {
        const groupSettings = (settings ?? []).filter((s) => !isRetiredSetting(s.key) && settingGroup(s.key) === group.id);
        const link = GROUP_LINKS[group.id];
        if (groupSettings.length === 0 && !link) return null;
        return (
          <Card key={group.id}>
            <CardHeader>
              <CardTitle>{group.title}</CardTitle>
              <CardDescription>
                {group.description}
                {link ? (
                  <>
                    {" "}
                    <Link href={link.href} className="tap-target font-medium text-pronex-pink underline-offset-4 hover:underline">
                      {link.label}
                    </Link>
                  </>
                ) : null}
              </CardDescription>
            </CardHeader>
            {groupSettings.length > 0 ? (
              <CardContent className="divide-y divide-white/5">
                {groupSettings.map((s) => {
            const def = settingDefinition(s.key);
            return (
              <div key={s.key} className="grid gap-2 py-3 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="text-sm font-medium">
                    {def.label} <span className="font-mono text-xs text-muted-foreground">{s.key}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{s.description ?? def.description}</p>
                </div>
                <AdminActionForm action={saveSettingAction} hidden={{ key: s.key }} submitLabel="Enregistrer" variant="outline" inline>
                  {def.kind === "boolean" ? (
                    <select name="value" defaultValue={s.value === true ? "true" : "false"} className={inputClass} aria-label={def.label}>
                      <option value="true">Activé</option>
                      <option value="false">Désactivé</option>
                    </select>
                  ) : def.kind === "integer" ? (
                    <input name="value" type="number" min={def.min} max={def.max} defaultValue={String(s.value)} className={`${inputClass} w-24`} aria-label={def.label} />
                  ) : def.kind === "enum" ? (
                    <select name="value" defaultValue={String(s.value)} className={inputClass} aria-label={def.label}>
                      {def.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : def.kind === "datetime" ? (
                    <input name="value" type="datetime-local" defaultValue={isoToPortoNovoInput(s.value)} className={inputClass} aria-label={def.label} />
                  ) : def.kind === "list" ? (
                    <input name="value" defaultValue={Array.isArray(s.value) ? s.value.join(", ") : ""} className={`${inputClass} w-64`} aria-label={def.label} />
                  ) : (
                    <input name="value" defaultValue={JSON.stringify(s.value)} className={`${inputClass} w-64 font-mono`} aria-label={def.label} />
                  )}
                </AdminActionForm>
              </div>
            );
          })}
              </CardContent>
            ) : null}
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle>Types de pronostics (marchés)</CardTitle>
          <CardDescription>Un marché inactif n&apos;est plus généré ni proposé ; les achats existants restent visibles.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {(markets ?? []).map((m) => (
            <div key={m.code} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="text-sm font-medium">
                  {m.label} <span className="font-mono text-xs text-muted-foreground">{m.code}</span>
                </p>
                {m.description ? <p className="text-xs text-muted-foreground">{m.description}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={m.is_active ? "default" : "outline"}>{m.is_active ? "Actif" : "Inactif"}</Badge>
                <AdminActionForm action={setMarketActiveAction} hidden={{ code: m.code, active: m.is_active ? "false" : "true" }} submitLabel={m.is_active ? "Désactiver" : "Activer"} variant="outline" inline />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </AdminPage>
  );
}
