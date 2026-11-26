import type { Metadata } from "next";
import { AdminPage, Field, inputClass, Stat } from "@/components/admin/table-tools";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminRpc } from "@/lib/admin/queries";
import { parseRevenuePeriod, revenueSchema } from "@/lib/admin/revenue";
import { requireAdmin } from "@/lib/auth/session";
import { formatXof } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Revenus · Administration" };

const PROVIDER_LABELS: Record<string, string> = { mock: "Paiement de test", fedapay: "FedaPay", kkiapay: "KkiaPay" };

function SimpleTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Aucune donnée sur la période.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {head.map((h, i) => (
            <TableHead key={h} className={i > 0 ? "text-right" : undefined}>
              {h}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={String(r[0])}>
            {r.map((c, i) => (
              <TableCell key={i} className={i > 0 ? "text-right tabular-nums" : undefined}>
                {c}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default async function AdminRevenusPage({ searchParams }: PageProps<"/admin/revenus">) {
  await requireAdmin();
  const { from, to } = parseRevenuePeriod(await searchParams);
  const revenue = revenueSchema.parse(await adminRpc("admin_revenue", { p_from: from, p_to: to }));

  return (
    <AdminPage title="Revenus" description="Recharges réussies et mouvements de crédits sur la période (jours de Porto-Novo).">
      <form className="flex flex-wrap items-end gap-3" method="get">
        <Field label="Du">
          <input type="date" name="du" defaultValue={from} className={inputClass} />
        </Field>
        <Field label="Au">
          <input type="date" name="au" defaultValue={to} className={inputClass} />
        </Field>
        <Button type="submit" size="sm" variant="outline">
          Afficher
        </Button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Chiffre d'affaires" value={formatXof(revenue.revenue_xof)} hint={`${revenue.topups} recharge(s), ${revenue.buyers} acheteur(s)`} />
        <Stat label="Crédits vendus" value={revenue.credits_sold} hint="Crédits des packs payés (aucun bonus)" />
        <Stat label="Crédits consommés" value={revenue.credits_consumed} hint="Déblocages" />
        <Stat label="Crédits remboursés" value={revenue.credits_refunded} hint={`${revenue.failed_topups} paiement(s) échoué(s) ou annulé(s)`} />
      </div>
      {revenue.by_provider.some((p) => p.provider === "mock") ? (
        <p className="text-sm text-muted-foreground">
          Les recharges « Paiement de test » sont simulées : elles ne correspondent à aucun argent réellement encaissé.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ventes par pack</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <SimpleTable
              head={["Pack", "Ventes", "Crédits", "Montant"]}
              rows={revenue.by_pack.map((p) => [p.pack_name, p.topups, p.credits, formatXof(p.revenue_xof)])}
            />
            <a href="/admin/transactions/export?vue=recharges&statut=succeeded&periode=tout" className="text-sm underline underline-offset-4">
              Exporter les ventes (CSV)
            </a>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Par moyen de paiement</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleTable
              head={["Moyen", "Recharges", "Montant"]}
              rows={revenue.by_provider.map((p) => [PROVIDER_LABELS[p.provider] ?? p.provider, p.topups, formatXof(p.revenue_xof)])}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Par jour</CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 space-y-4 overflow-y-auto">
            <DailyBars days={revenue.by_day} />
            <SimpleTable head={["Jour", "Recharges", "Montant"]} rows={revenue.by_day.map((d) => [d.day, d.topups, formatXof(d.revenue_xof)])} />
          </CardContent>
        </Card>
      </div>
    </AdminPage>
  );
}

/** Barres du chiffre d'affaires quotidien (jours avec au moins une recharge payée). */
function DailyBars({ days }: { days: { day: string; revenue_xof: number; topups: number }[] }) {
  if (days.length === 0) return null;
  const max = Math.max(1, ...days.map((d) => d.revenue_xof));
  return (
    <ul className="space-y-1.5" aria-label="Chiffre d'affaires par jour">
      {days.map((d) => (
        <li key={d.day} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-2 text-xs">
          <span className="text-muted-foreground tabular-nums">{d.day}</span>
          <span className="h-2 overflow-hidden rounded-full bg-white/8">
            <span className="block h-full rounded-full bg-pronex-violet" style={{ width: `${(d.revenue_xof / max) * 100}%` }} />
          </span>
          <span className="tabular-nums">{formatXof(d.revenue_xof)}</span>
        </li>
      ))}
    </ul>
  );
}
