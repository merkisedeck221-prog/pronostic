import type { Metadata } from "next";
import { AdminActionForm } from "@/components/admin/action-form";
import { AdminPage, Field, inputClass } from "@/components/admin/table-tools";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { savePaymentMethodsAction } from "@/lib/admin/actions/payments";
import { requireAdmin } from "@/lib/auth/session";
import { getPaymentProvider } from "@/lib/payments";
import { PAYMENT_PROVIDER_NAMES } from "@/lib/payments/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Moyens de paiement · Administration" };

const DEFAULT_LABELS: Record<string, string> = {
  mock: "Paiement de test",
  fedapay: "Mobile Money (FedaPay)",
  kkiapay: "Mobile Money (KkiaPay)",
};

function configuredProvider(): string | null {
  try {
    return getPaymentProvider().name;
  } catch {
    return null;
  }
}

export default async function AdminPaiementsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", "payment_methods").maybeSingle();
  const settings = (data?.value ?? {}) as Record<string, { enabled?: boolean; label?: string } | undefined>;
  const active = configuredProvider();

  return (
    <AdminPage
      title="Moyens de paiement"
      description="Activez ou désactivez un moyen de paiement et choisissez son libellé. Un moyen désactivé est refusé par la base, même si on contourne l'interface."
    >
      <Card>
        <CardHeader>
          <CardTitle>Fournisseur technique</CardTitle>
          <CardDescription>
            Choisi par la variable Vercel <code>PAYMENT_PROVIDER</code> ; ses clés secrètes restent dans Vercel, jamais ici.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {active ? (
            <p>
              Fournisseur utilisé pour les nouvelles recharges : <Badge>{active}</Badge>
            </p>
          ) : (
            <p className="text-destructive">Aucun fournisseur valide n&apos;est configuré : les recharges sont impossibles.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activation et libellés</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminActionForm action={savePaymentMethodsAction} submitLabel="Enregistrer">
            <div className="space-y-3">
              {PAYMENT_PROVIDER_NAMES.map((name) => {
                const s = settings[name];
                return (
                  <div key={name} className="flex flex-wrap items-end gap-3 rounded-md border p-3">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input type="checkbox" name={`enabled_${name}`} defaultChecked={s?.enabled !== false} className="size-4" />
                      {name}
                      {name === active ? <Badge variant="outline">utilisé</Badge> : null}
                    </label>
                    <Field label="Libellé affiché">
                      <input
                        name={`label_${name}`}
                        required
                        minLength={2}
                        maxLength={60}
                        defaultValue={s?.label ?? DEFAULT_LABELS[name]}
                        className={`${inputClass} w-64`}
                      />
                    </Field>
                  </div>
                );
              })}
            </div>
          </AdminActionForm>
        </CardContent>
      </Card>
    </AdminPage>
  );
}
