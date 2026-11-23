import type { Metadata } from "next";
import { AdminActionForm } from "@/components/admin/action-form";
import { AdminPage, Field, inputClass } from "@/components/admin/table-tools";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { savePromoAction, setPromoActiveAction } from "@/lib/admin/actions/promotions";
import { ADMIN_TIMEZONE, utcToLocalInput } from "@/lib/admin/datetime";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";
import { formatDateTime } from "@/lib/utils/dates";
import { formatXof } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Promotions · Administration" };

type Promo = Tables<"promo_codes">;

function PromoFields({ promo }: { promo?: Promo }) {
  return (
    <>
      <Field label="Code">
        <input name="code" required minLength={3} maxLength={30} pattern="[A-Za-z0-9_\-]{3,30}" defaultValue={promo?.code} className={`${inputClass} w-36 uppercase`} />
      </Field>
      <Field label="Type de bonus">
        <select name="kind" defaultValue={promo?.kind ?? "bonus_credits"} className={`${inputClass} w-40`}>
          <option value="bonus_credits">Crédits offerts</option>
          <option value="bonus_percent">% des crédits du pack</option>
        </select>
      </Field>
      <Field label="Valeur">
        <input name="value" type="number" min={1} max={100000} required defaultValue={promo?.value} className={`${inputClass} w-24`} />
      </Field>
      <Field label="Début (Porto-Novo)">
        <input name="starts_at" type="datetime-local" defaultValue={utcToLocalInput(promo?.starts_at)} className={`${inputClass} w-52`} />
      </Field>
      <Field label="Fin">
        <input name="ends_at" type="datetime-local" defaultValue={utcToLocalInput(promo?.ends_at)} className={`${inputClass} w-52`} />
      </Field>
      <Field label="Utilisations max. (vide = illimité)">
        <input name="max_uses" type="number" min={1} defaultValue={promo?.max_uses ?? ""} className={`${inputClass} w-24`} />
      </Field>
      <Field label="Par utilisateur">
        <input name="max_uses_per_user" type="number" min={1} max={1000} required defaultValue={promo?.max_uses_per_user ?? 1} className={`${inputClass} w-20`} />
      </Field>
      <Field label="Pack minimum (XOF)">
        <input name="min_price_xof" type="number" min={0} defaultValue={promo?.min_price_xof ?? 0} className={`${inputClass} w-28`} />
      </Field>
      <Field label="Description (interne)">
        <input name="description" maxLength={200} defaultValue={promo?.description ?? ""} className={`${inputClass} w-64`} />
      </Field>
    </>
  );
}

function bonusText(p: Promo): string {
  return p.kind === "bonus_percent" ? `+${p.value} % des crédits du pack` : `+${p.value} crédit${p.value > 1 ? "s" : ""}`;
}

export default async function AdminPromotionsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: promos, error }, { data: uses }] = await Promise.all([
    supabase.from("promo_codes").select("*").order("created_at", { ascending: false }),
    supabase.from("topups").select("promo_code_id, promo_bonus_credits").eq("status", "succeeded").not("promo_code_id", "is", null).limit(10000),
  ]);
  if (error) throw new Error(error.message);
  const stats = new Map<number, { count: number; credits: number }>();
  for (const u of uses ?? []) {
    if (!u.promo_code_id) continue;
    const s = stats.get(u.promo_code_id) ?? { count: 0, credits: 0 };
    stats.set(u.promo_code_id, { count: s.count + 1, credits: s.credits + u.promo_bonus_credits });
  }

  return (
    <AdminPage
      title="Promotions"
      description="Codes promo saisis par l'utilisateur au moment de la recharge. Le bonus est calculé et vérifié par la base ; un code n'est jamais visible par les utilisateurs."
    >
      <Card>
        <CardHeader>
          <CardTitle>Nouveau code promo</CardTitle>
          <CardDescription>Actif dès sa création (dans sa période). Un code ne se supprime pas : il se désactive.</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminActionForm action={savePromoAction} submitLabel="Créer" inline>
            <PromoFields />
          </AdminActionForm>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {(promos ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Aucun code promo.</p> : null}
        {(promos ?? []).map((p) => {
          const s = stats.get(p.id) ?? { count: 0, credits: 0 };
          return (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2 font-mono">
                  {p.code}
                  <Badge variant={p.is_active ? "default" : "outline"}>{p.is_active ? "Actif" : "Inactif"}</Badge>
                </CardTitle>
                <CardDescription>
                  {bonusText(p)} · {s.count} utilisation(s) payée(s){p.max_uses ? ` sur ${p.max_uses}` : ""} · {s.credits} crédits offerts
                  {p.min_price_xof > 0 ? ` · pack de ${formatXof(p.min_price_xof)} minimum` : ""}
                  {p.ends_at ? ` · jusqu'au ${formatDateTime(p.ends_at, ADMIN_TIMEZONE)}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <AdminActionForm action={savePromoAction} hidden={{ id: p.id }} submitLabel="Enregistrer" variant="outline" inline>
                  <PromoFields promo={p} />
                </AdminActionForm>
                <AdminActionForm
                  action={setPromoActiveAction}
                  hidden={{ id: p.id, active: p.is_active ? "false" : "true" }}
                  submitLabel={p.is_active ? "Désactiver" : "Activer"}
                  variant="outline"
                  inline
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AdminPage>
  );
}
