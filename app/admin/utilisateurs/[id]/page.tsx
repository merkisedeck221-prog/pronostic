import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminActionForm } from "@/components/admin/action-form";
import { AdminPage, Field, Stat, inputClass } from "@/components/admin/table-tools";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adjustBalanceAction, setUserBannedAction, setUserRoleAction } from "@/lib/admin/actions/users";
import { requireAdmin } from "@/lib/auth/session";
import { formatSignedAmount, transactionTypeLabel } from "@/lib/credits/labels";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, resolveTimezone } from "@/lib/utils/dates";
import { formatXof } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Fiche utilisateur · Administration" };

type AdminUser = {
  id: string;
  email: string;
  display_name: string;
  country: string | null;
  phone: string | null;
  timezone: string;
  role: "user" | "admin";
  is_banned: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  balance: number;
  ledger_sum: number;
};

const TOPUP_STATUS = { pending: "En attente", succeeded: "Réussie", failed: "Échouée", cancelled: "Annulée" } as const;

export default async function AdminUserPage({ params }: PageProps<"/admin/utilisateurs/[id]">) {
  const admin = await requireAdmin();
  const tz = resolveTimezone(admin.profile.timezone);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_get_user", { p_user_id: id });
  const result = data as { ok: boolean; user?: AdminUser } | null;
  if (!result?.ok || !result.user) notFound();
  const user = result.user;
  const self = user.id === admin.id;

  const [{ data: transactions }, { data: unlocks }, { data: topups }] = await Promise.all([
    supabase.from("credit_transactions").select("id, type, amount, balance_after, description, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(50),
    supabase
      .from("unlocks")
      .select("id, market_code, credits_spent, refunded_at, created_at, fixture:fixtures(id, home:teams!fixtures_home_team_id_fkey(name), away:teams!fixtures_away_team_id_fkey(name))")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("topups").select("id, credits, amount_xof, provider, status, created_at, pack:credit_packs(name)").eq("user_id", id).order("created_at", { ascending: false }).limit(50),
  ]);

  return (
    <AdminPage title={user.display_name} description={user.email}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Solde" value={`${user.balance} crédits`} hint={user.ledger_sum !== user.balance ? `⚠ Somme des transactions : ${user.ledger_sum}` : "Cohérent avec les transactions"} />
        <Stat label="Inscription" value={formatDateTime(user.created_at, tz)} hint={user.email_confirmed_at ? "E-mail confirmé" : "E-mail non confirmé"} />
        <Stat label="Dernière connexion" value={user.last_sign_in_at ? formatDateTime(user.last_sign_in_at, tz) : "—"} />
        <Stat
          label="Statut"
          value={
            <span className="space-x-1">
              {user.role === "admin" ? <Badge>Admin</Badge> : null}
              <Badge variant={user.is_banned ? "destructive" : "outline"}>{user.is_banned ? "Suspendu" : "Actif"}</Badge>
            </span>
          }
          hint={`${user.country ?? "—"} · ${user.phone ?? "pas de téléphone"} · ${user.timezone}`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-2">
            <p className="text-sm font-medium">Ajuster le solde</p>
            <AdminActionForm action={adjustBalanceAction} hidden={{ userId: user.id }} submitLabel="Ajuster" confirmMessage="Confirmer l'ajustement du solde ?">
              <Field label="Montant (+ crédit, − débit)">
                <input name="amount" type="number" step={1} required className={inputClass} placeholder="ex. 10 ou -5" />
              </Field>
              <Field label="Motif (obligatoire)">
                <input name="reason" required minLength={3} className={inputClass} placeholder="ex. geste commercial" />
              </Field>
            </AdminActionForm>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{user.is_banned ? "Réactiver le compte" : "Suspendre le compte"}</p>
            {self ? (
              <p className="text-sm text-muted-foreground">Impossible sur votre propre compte.</p>
            ) : (
              <AdminActionForm
                action={setUserBannedAction}
                hidden={{ userId: user.id, banned: user.is_banned ? "false" : "true" }}
                submitLabel={user.is_banned ? "Réactiver" : "Suspendre"}
                variant={user.is_banned ? "default" : "destructive"}
                confirmMessage={user.is_banned ? "Réactiver ce compte ?" : "Suspendre ce compte ? L'utilisateur ne pourra plus rien faire."}
              >
                <Field label="Motif (obligatoire)">
                  <input name="reason" required minLength={3} className={inputClass} />
                </Field>
              </AdminActionForm>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{user.role === "admin" ? "Retirer le rôle administrateur" : "Promouvoir administrateur"}</p>
            {self ? (
              <p className="text-sm text-muted-foreground">Impossible sur votre propre compte.</p>
            ) : (
              <AdminActionForm
                action={setUserRoleAction}
                hidden={{ userId: user.id, role: user.role === "admin" ? "user" : "admin" }}
                submitLabel={user.role === "admin" ? "Retirer le rôle" : "Promouvoir"}
                variant="outline"
                confirmMessage={
                  user.role === "admin"
                    ? "Retirer le rôle administrateur ?"
                    : "Donner à cet utilisateur un accès complet à l'administration ? (1re confirmation)"
                }
              >
                <Field label="Motif (obligatoire)">
                  <input name="reason" required minLength={3} className={inputClass} />
                </Field>
                {user.role === "admin" ? null : (
                  <Field label="Tapez PROMOUVOIR (2e confirmation)">
                    <input name="confirm" required className={inputClass} autoComplete="off" />
                  </Field>
                )}
              </AdminActionForm>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transactions (50 dernières)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead className="text-right">Solde après</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(transactions ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(t.created_at, tz)}</TableCell>
                  <TableCell>{transactionTypeLabel(t.type)}</TableCell>
                  <TableCell className="whitespace-normal">{t.description}</TableCell>
                  <TableCell className={`text-right tabular-nums ${t.amount > 0 ? "text-green-700 dark:text-green-400" : "text-destructive"}`}>
                    {formatSignedAmount(t.amount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{t.balance_after}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Link href={`/admin/transactions?utilisateur=${user.id}`} className="mt-2 inline-block text-sm underline-offset-4 hover:underline">
            Toutes les transactions de cet utilisateur
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Déblocages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {(unlocks ?? []).length === 0 ? <p className="text-muted-foreground">Aucun.</p> : null}
            {(unlocks ?? []).map((u) => (
              <p key={u.id}>
                <Link href={`/admin/matchs/${u.fixture?.id}`} className="underline-offset-4 hover:underline">
                  {u.fixture ? `${u.fixture.home.name} – ${u.fixture.away.name}` : "Match"}
                </Link>{" "}
                · {u.market_code ?? "match complet"} · {u.credits_spent} cr. · {formatDateTime(u.created_at, tz)}
                {u.refunded_at ? " · remboursé" : ""}
              </p>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recharges</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {(topups ?? []).length === 0 ? <p className="text-muted-foreground">Aucune.</p> : null}
            {(topups ?? []).map((t) => (
              <p key={t.id}>
                {formatDateTime(t.created_at, tz)} · {t.pack?.name ?? "pack"} · {t.credits} cr. · {formatXof(t.amount_xof)} ·{" "}
                {TOPUP_STATUS[t.status]} ({t.provider})
              </p>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminPage>
  );
}
