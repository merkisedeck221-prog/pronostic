import type { Metadata } from "next";
import { AdminActionForm } from "@/components/admin/action-form";
import { AdminPage, Field, inputClass } from "@/components/admin/table-tools";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { deletePackAction, savePackAction, setPackActiveAction } from "@/lib/admin/actions/packs";
import { utcToLocalInput } from "@/lib/admin/datetime";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_TIMEZONE } from "@/lib/admin/datetime";
import { formatDateTime } from "@/lib/utils/dates";
import { formatXof } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Packs de recharge · Administration" };

type PackValues = {
  name: string;
  credits: number;
  bonus_credits: number;
  price_xof: number;
  sort_order: number;
  description: string | null;
  available_from: string | null;
  available_until: string | null;
};

function PackFields({ pack }: { pack?: PackValues }) {
  return (
    <>
      <Field label="Nom">
        <input name="name" required minLength={2} maxLength={40} defaultValue={pack?.name} className={`${inputClass} w-36`} />
      </Field>
      <Field label="Crédits">
        <input name="credits" type="number" min={1} required defaultValue={pack?.credits} className={`${inputClass} w-24`} />
      </Field>
      <Field label="Bonus">
        <input name="bonus_credits" type="number" min={0} required defaultValue={pack?.bonus_credits ?? 0} className={`${inputClass} w-20`} />
      </Field>
      <Field label="Prix (XOF)">
        <input name="price_xof" type="number" min={1} required defaultValue={pack?.price_xof} className={`${inputClass} w-28`} />
      </Field>
      <Field label="Ordre">
        <input name="sort_order" type="number" min={0} max={9999} defaultValue={pack?.sort_order ?? 0} className={`${inputClass} w-20`} />
      </Field>
      <Field label="Description (facultatif)">
        <input name="description" maxLength={200} defaultValue={pack?.description ?? ""} className={`${inputClass} w-64`} />
      </Field>
      <Field label="Offre à partir du (heure de Porto-Novo)">
        <input name="available_from" type="datetime-local" defaultValue={utcToLocalInput(pack?.available_from)} className={`${inputClass} w-52`} />
      </Field>
      <Field label="Offre jusqu'au">
        <input name="available_until" type="datetime-local" defaultValue={utcToLocalInput(pack?.available_until)} className={`${inputClass} w-52`} />
      </Field>
    </>
  );
}

export default async function AdminPacksPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: packs, error }, { data: sold }] = await Promise.all([
    supabase.from("credit_packs").select("*").order("sort_order").order("price_xof"),
    supabase.from("topups").select("pack_id").not("pack_id", "is", null).limit(10000),
  ]);
  if (error) throw new Error(error.message);
  const purchases = new Map<number, number>();
  for (const t of sold ?? []) if (t.pack_id) purchases.set(t.pack_id, (purchases.get(t.pack_id) ?? 0) + 1);

  return (
    <AdminPage
      title="Packs de recharge"
      description="Un pack déjà acheté ne se supprime pas : il se désactive. Les dates limitent la période de vente ; les crédits achetés n'expirent jamais."
    >
      <div className="space-y-3">
        {(packs ?? []).map((pack) => {
          const count = purchases.get(pack.id) ?? 0;
          return (
            <Card key={pack.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {pack.name}
                  <Badge variant={pack.is_active ? "default" : "outline"}>{pack.is_active ? "Actif" : "Inactif"}</Badge>
                </CardTitle>
                <CardDescription>
                  {pack.credits} crédits + {pack.bonus_credits} bonus · {formatXof(pack.price_xof)} · {count} achat(s)
                  {pack.available_from || pack.available_until
                    ? ` · en vente ${pack.available_from ? `du ${formatDateTime(pack.available_from, ADMIN_TIMEZONE)} ` : ""}${pack.available_until ? `jusqu'au ${formatDateTime(pack.available_until, ADMIN_TIMEZONE)}` : ""}`
                    : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <AdminActionForm action={savePackAction} hidden={{ id: pack.id }} submitLabel="Enregistrer" variant="outline" inline>
                  <PackFields pack={pack} />
                </AdminActionForm>
                <div className="flex flex-wrap gap-2">
                  <AdminActionForm
                    action={setPackActiveAction}
                    hidden={{ id: pack.id, active: pack.is_active ? "false" : "true" }}
                    submitLabel={pack.is_active ? "Désactiver" : "Activer"}
                    variant="outline"
                    inline
                  />
                  {count === 0 ? (
                    <AdminActionForm action={deletePackAction} hidden={{ id: pack.id }} submitLabel="Supprimer" variant="ghost" confirmMessage={`Supprimer le pack ${pack.name} ?`} inline />
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nouveau pack</CardTitle>
          <CardDescription>Créé inactif : activez-le pour le proposer.</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminActionForm action={savePackAction} submitLabel="Créer" inline>
            <PackFields />
          </AdminActionForm>
        </CardContent>
      </Card>
    </AdminPage>
  );
}
