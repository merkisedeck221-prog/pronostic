import type { Metadata } from "next";
import Link from "next/link";
import { AdminPage, Pagination, Stat } from "@/components/admin/table-tools";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { pageCount, pageRange, parsePageParam } from "@/lib/admin/params";
import { adminRpc } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { formatRate } from "@/lib/settle/labels";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, resolveTimezone } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Suivi de l'IA · Administration" };
const PATH = "/admin/ia";

type Period = { period: string; runs: number; failed: number; input_tokens: number; output_tokens: number; cost_usd: number };
type PromptStat = { prompt_version: string; runs: number; failed: number; won: number; lost: number };

const n = (v: number) => new Intl.NumberFormat("fr-FR").format(v);
const usd = (v: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 4 }).format(v)} $`;
const pct = (part: number, total: number) => (total === 0 ? "—" : `${Math.round((part / total) * 1000) / 10} %`);

function PeriodTable({ rows, label }: { rows: Period[]; label: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{label}</TableHead>
          <TableHead className="text-right">Générations</TableHead>
          <TableHead className="text-right">Échecs</TableHead>
          <TableHead className="text-right">Tokens</TableHead>
          <TableHead className="text-right">Coût estimé</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground">
              Aucune donnée.
            </TableCell>
          </TableRow>
        ) : null}
        {rows.map((r) => (
          <TableRow key={r.period}>
            <TableCell>{r.period}</TableCell>
            <TableCell className="text-right tabular-nums">{n(r.runs)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {n(r.failed)} ({pct(r.failed, r.runs)})
            </TableCell>
            <TableCell className="text-right tabular-nums">{n(r.input_tokens + r.output_tokens)}</TableCell>
            <TableCell className="text-right tabular-nums">{usd(Number(r.cost_usd))}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default async function AdminAiPage({ searchParams }: PageProps<"/admin/ia">) {
  const admin = await requireAdmin();
  const tz = resolveTimezone(admin.profile.timezone);
  const params = await searchParams;
  const page = parsePageParam(params.page);
  const range = pageRange(page);

  const supabase = await createClient();
  const [stats, runs] = await Promise.all([
    adminRpc<{ by_day: Period[]; by_month: Period[]; by_prompt: PromptStat[] }>("admin_ai_stats"),
    supabase.from("ai_generation_runs").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(range.from, range.to),
  ]);
  if (runs.error) throw new Error(runs.error.message);
  const month = stats.by_month[0];
  const totalRuns = stats.by_prompt.reduce((s, p) => s + p.runs, 0);
  const totalFailed = stats.by_prompt.reduce((s, p) => s + p.failed, 0);

  return (
    <AdminPage title="Suivi de l'IA" description="Générations, tokens, coût estimé (tarifs indicatifs de lib/ai/pricing.ts), échecs et versions de prompt.">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Générations (total)" value={n(totalRuns)} />
        <Stat label="Taux d'échec (total)" value={pct(totalFailed, totalRuns)} />
        <Stat label="Tokens ce mois-ci" value={month ? n(month.input_tokens + month.output_tokens) : "0"} hint={month?.period} />
        <Stat label="Coût estimé ce mois-ci" value={month ? usd(Number(month.cost_usd)) : "0 $"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Par version de prompt</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead className="text-right">Générations</TableHead>
                <TableHead className="text-right">Échecs</TableHead>
                <TableHead className="text-right">Gagnés</TableHead>
                <TableHead className="text-right">Perdus</TableHead>
                <TableHead className="text-right">Taux de réussite</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.by_prompt.map((p) => (
                <TableRow key={p.prompt_version}>
                  <TableCell className="font-medium">{p.prompt_version}</TableCell>
                  <TableCell className="text-right tabular-nums">{n(p.runs)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {n(p.failed)} ({pct(p.failed, p.runs)})
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{n(p.won)}</TableCell>
                  <TableCell className="text-right tabular-nums">{n(p.lost)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatRate(p.won, p.lost)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Par jour (30 jours)</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <PeriodTable rows={stats.by_day} label="Jour" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Par mois (12 mois)</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <PeriodTable rows={stats.by_month} label="Mois" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique des générations</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Match</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Modèle</TableHead>
                <TableHead>Prompt</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Coût</TableHead>
                <TableHead className="text-right">Durée</TableHead>
                <TableHead>Erreur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(runs.data ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(r.created_at, tz)}</TableCell>
                  <TableCell>
                    {r.fixture_id ? (
                      <Link href={`/admin/matchs/${r.fixture_id}`} className="underline-offset-4 hover:underline">
                        {r.fixture_id}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === "success" ? "default" : "destructive"}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{r.model}</TableCell>
                  <TableCell>{r.prompt_version}</TableCell>
                  <TableCell className="text-right tabular-nums">{n((r.input_tokens ?? 0) + (r.output_tokens ?? 0))}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.cost_estimate_usd !== null ? usd(Number(r.cost_estimate_usd)) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.duration_ms !== null ? `${Math.round(r.duration_ms / 100) / 10} s` : "—"}</TableCell>
                  <TableCell className="max-w-72 truncate text-xs text-muted-foreground" title={r.error ?? undefined}>
                    {r.error ?? ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination path={PATH} params={params} page={page} pageCount={pageCount(runs.count ?? 0)} total={runs.count ?? 0} />
        </CardContent>
      </Card>
    </AdminPage>
  );
}
