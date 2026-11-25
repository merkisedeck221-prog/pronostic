import type { Metadata } from "next";
import Link from "next/link";
import { AdminActionForm } from "@/components/admin/action-form";
import { AdminPage, FilterBar, FilterInput, FilterSelect, inputClass, Pagination } from "@/components/admin/table-tools";
import { reverseTransactionAction } from "@/lib/admin/actions/payments";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { pageCount, pageRange, parsePageParam, withParams } from "@/lib/admin/params";
import { adminRpc } from "@/lib/admin/queries";
import { parseTransactionFilters, queryTopups, queryTransactions } from "@/lib/admin/transactions";
import { requireAdmin } from "@/lib/auth/session";
import { formatSignedAmount, transactionTypeLabel } from "@/lib/credits/labels";
import { formatDateTime, resolveTimezone } from "@/lib/utils/dates";
import { formatXof } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Transactions · Administration" };
const PATH = "/admin/transactions";
const TOPUP_STATUS = { pending: "En attente", succeeded: "Réussie", failed: "Échouée", cancelled: "Annulée" } as const;

type ConsistencyRow = { user_id: string; email: string; display_name: string; balance: number; ledger: number; difference: number };

export default async function AdminTransactionsPage({ searchParams }: PageProps<"/admin/transactions">) {
  const admin = await requireAdmin();
  const tz = resolveTimezone(admin.profile.timezone);
  const params = await searchParams;
  const filters = parseTransactionFilters(params);
  const page = parsePageParam(params.page);
  const range = pageRange(page);
  const checking = params.controle === "1";

  const [movements, topups, consistency] = await Promise.all([
    filters.view === "mouvements" ? queryTransactions(filters, range) : null,
    filters.view === "recharges" ? queryTopups(filters, range) : null,
    checking ? adminRpc<{ checked: number; rows: ConsistencyRow[] }>("admin_consistency_check") : null,
  ]);
  const total = movements?.total ?? topups?.total ?? 0;
  const exportHref = withParams(`${PATH}/export`, params, { page: null, controle: null });

  return (
    <AdminPage
      title="Transactions"
      description="Journal de tous les mouvements de crédits et de toutes les recharges."
      actions={
        <div className="flex flex-wrap gap-2">
          <a href={exportHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Exporter en CSV
          </a>
          <Link href={withParams(PATH, params, { controle: "1" })} className={buttonVariants({ size: "sm" })}>
            Contrôle de cohérence
          </Link>
        </div>
      }
    >
      {consistency ? (
        <Card>
          <CardHeader>
            <CardTitle>Contrôle de cohérence (RG-F6-4)</CardTitle>
            <CardDescription>
              {consistency.checked} portefeuille(s) vérifié(s) : solde = somme des transactions.{" "}
              {consistency.rows.length === 0 ? "Aucune anomalie." : `${consistency.rows.length} anomalie(s).`}
            </CardDescription>
          </CardHeader>
          {consistency.rows.length > 0 ? (
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead className="text-right">Solde</TableHead>
                    <TableHead className="text-right">Somme des transactions</TableHead>
                    <TableHead className="text-right">Écart</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consistency.rows.map((r) => (
                    <TableRow key={r.user_id}>
                      <TableCell>
                        <Link href={`/admin/utilisateurs/${r.user_id}`} className="underline-offset-4 hover:underline">
                          {r.display_name}
                        </Link>
                        <span className="block text-xs text-muted-foreground">{r.email}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.balance}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.ledger}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-destructive">{r.difference}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          ) : null}
        </Card>
      ) : null}

      <FilterBar resetHref={PATH}>
        <FilterSelect name="vue" label="Vue" value={filters.view} options={[{ value: "mouvements", label: "Mouvements de crédits" }, { value: "recharges", label: "Recharges" }]} />
        {filters.view === "mouvements" ? (
          <FilterSelect
            name="type"
            label="Type"
            value={filters.type}
            options={[
              { value: "tous", label: "Tous" },
              { value: "topup", label: "Recharge" },
              { value: "unlock", label: "Déblocage" },
              { value: "bonus", label: "Bonus (historique)" },
              { value: "refund", label: "Remboursement" },
              { value: "admin_adjustment", label: "Ajustement" },
            ]}
          />
        ) : (
          <FilterSelect
            name="statut"
            label="Statut"
            value={filters.topupStatus}
            options={[
              { value: "tous", label: "Tous" },
              { value: "pending", label: "En attente" },
              { value: "succeeded", label: "Réussies" },
              { value: "failed", label: "Échouées" },
              { value: "cancelled", label: "Annulées" },
            ]}
          />
        )}
        <FilterSelect
          name="periode"
          label="Période"
          value={filters.period}
          options={[
            { value: "7j", label: "7 jours" },
            { value: "30j", label: "30 jours" },
            { value: "90j", label: "90 jours" },
            { value: "tout", label: "Tout" },
          ]}
        />
        <FilterInput name="utilisateur" label="Utilisateur (e-mail, nom ou identifiant)" value={filters.user} className="min-w-64" />
      </FilterBar>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-card">
        {movements ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead className="text-right">Solde après</TableHead>
                <TableHead>Annulation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Aucun mouvement.
                  </TableCell>
                </TableRow>
              ) : null}
              {movements.rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(t.created_at, tz)}</TableCell>
                  <TableCell>
                    <Link href={`/admin/utilisateurs/${t.user_id}`} className="underline-offset-4 hover:underline">
                      {t.display_name ?? t.user_id.slice(0, 8)}
                    </Link>
                  </TableCell>
                  <TableCell>{transactionTypeLabel(t.type as Parameters<typeof transactionTypeLabel>[0])}</TableCell>
                  <TableCell className="whitespace-normal">
                    <span className="text-xs text-muted-foreground">n° {t.id} · </span>
                    {t.description}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${t.amount > 0 ? "text-emerald-300" : "text-destructive"}`}>
                    {formatSignedAmount(t.amount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{t.balance_after}</TableCell>
                  <TableCell className="min-w-64">
                    {t.reference_type === "reversal" ? (
                      <span className="text-xs text-muted-foreground">Écriture d&apos;annulation</span>
                    ) : (
                      <AdminActionForm
                        action={reverseTransactionAction}
                        hidden={{ id: t.id }}
                        submitLabel={t.amount < 0 ? "Rembourser" : "Annuler"}
                        variant="outline"
                        confirmMessage={`${t.amount < 0 ? "Rembourser" : "Annuler"} la transaction n° ${t.id} (${formatSignedAmount(-t.amount)} crédits) ?`}
                        inline
                      >
                        <input name="reason" required minLength={3} maxLength={500} placeholder="Motif" aria-label={`Motif pour la transaction n° ${t.id}`} className={`${inputClass} w-32`} />
                      </AdminActionForm>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Pack</TableHead>
                <TableHead className="text-right">Crédits</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(topups?.rows ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Aucune recharge.
                  </TableCell>
                </TableRow>
              ) : null}
              {(topups?.rows ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(t.created_at, tz)}</TableCell>
                  <TableCell>
                    <Link href={`/admin/utilisateurs/${t.user_id}`} className="underline-offset-4 hover:underline">
                      {t.display_name ?? t.user_id.slice(0, 8)}
                    </Link>
                  </TableCell>
                  <TableCell>{t.pack ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {t.credits}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatXof(t.amount_xof)}</TableCell>
                  <TableCell>{t.provider}</TableCell>
                  <TableCell>{TOPUP_STATUS[t.status as keyof typeof TOPUP_STATUS] ?? t.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <Pagination path={PATH} params={params} page={page} pageCount={pageCount(total)} total={total} />
    </AdminPage>
  );
}
