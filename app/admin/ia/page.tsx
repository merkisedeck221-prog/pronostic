import type { Metadata } from "next";
import Link from "next/link";
import { AdminPage, Pagination, Stat } from "@/components/admin/table-tools";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { pageCount, pageRange, parsePageParam } from "@/lib/admin/params";
import { adminRpc } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { PROMPT_VERSION } from "@/lib/ai/prompts/v4";
import { formatRate } from "@/lib/settle/labels";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, resolveTimezone } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Suivi de l'IA · Administration" };
const PATH = "/admin/ia";

type Period = { period: string; runs: number; failed: number; input_tokens: number; output_tokens: number; cost_usd: number };
type PromptStat = { prompt_version: string; runs: number; failed: number; won: number; lost: number };

/** Date ISO d'il y a `days` jours (calculée à la requête, page dynamique). */
function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
}

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

type OnDemandRow = {
  id: string;
  created_at: string;
  status: string;
  price: number;
  market_code: string | null;
  error: string | null;
  user_id: string;
  display_name: string;
  fixture_id: number;
  match: string;
};

const ON_DEMAND_STATUS: Record<string, string> = {
  reserved: "Crédits réservés",
  running: "En cours",
  succeeded: "Réussie (débitée)",
  failed: "Échouée (crédits rendus)",
};

export default async function AdminAiPage({ searchParams }: PageProps<"/admin/ia">) {
  const admin = await requireAdmin();
  const tz = resolveTimezone(admin.profile.timezone);
  const params = await searchParams;
  const page = parsePageParam(params.page);
  const range = pageRange(page);

  const supabase = await createClient();
  const since30 = daysAgoIso(30);
  const [stats, onDemand, runs, failures, recentRuns, dossiers] = await Promise.all([
    adminRpc<{ by_day: Period[]; by_month: Period[]; by_prompt: PromptStat[] }>("admin_ai_stats"),
    adminRpc<{ rows: OnDemandRow[]; counts: Record<string, number> | null }>("admin_generation_requests", { p_limit: 50 }),
    supabase.from("ai_generation_runs").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(range.from, range.to),
    supabase.from("ai_generation_runs").select("error").eq("status", "failed").order("created_at", { ascending: false }).limit(200),
    supabase.from("ai_generation_runs").select("status, duration_ms, created_at").order("created_at", { ascending: false }).limit(100),
    // Qualité des données : dossiers des 30 derniers jours et erreurs de collecte (jamais le contenu du dossier).
    supabase.from("match_contexts").select("fixture_id, fetched_at, errors:raw->errors, insufficient:summary->data_quality->insufficient_data").gte("fetched_at", since30).order("fetched_at", { ascending: false }).limit(500),
  ]);
  // Moteur : configuration (sans aucune valeur secrète) et derniers résultats.
  const keyConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  const model = process.env.OPENAI_MODEL?.trim() || null;
  const last = recentRuns.data?.[0] ?? null;
  const durations = (recentRuns.data ?? []).map((r) => r.duration_ms).filter((d): d is number => typeof d === "number").sort((a, b) => a - b);
  const median = durations.length ? durations[Math.floor(durations.length / 2)] : null;
  const p90 = durations.length ? durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.9))] : null;
  const recentFailed = (recentRuns.data ?? []).filter((r) => r.status === "failed").length;
  // Erreurs les plus fréquentes (validation de la réponse, API, budget…), regroupées par début de message.
  const errorGroups = new Map<string, number>();
  for (const f of failures.data ?? []) {
    const key = (f.error ?? "Erreur sans message").replace(/\d+/g, "#").slice(0, 90);
    errorGroups.set(key, (errorGroups.get(key) ?? 0) + 1);
  }
  const topErrors = [...errorGroups.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const dossierRows = dossiers.data ?? [];
  const dossierWithErrors = dossierRows.filter((d) => Array.isArray(d.errors) && d.errors.length > 0).length;
  const dossierInsufficient = dossierRows.filter((d) => d.insufficient === true).length;
  if (runs.error) throw new Error(runs.error.message);
  const month = stats.by_month[0];
  const totalRuns = stats.by_prompt.reduce((s, p) => s + p.runs, 0);
  const totalFailed = stats.by_prompt.reduce((s, p) => s + p.failed, 0);

  return (
    <AdminPage title="Suivi de l'IA" description="Générations, tokens, coût estimé (tarifs indicatifs de lib/ai/pricing.ts), échecs et versions de prompt.">
      <Card className={!keyConfigured || recentFailed > 0 ? "border-warning/40" : "border-success/30"}>
        <CardHeader>
          <CardTitle>État du moteur IA</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Configuration</p>
            <p className={keyConfigured ? "font-semibold text-success" : "font-semibold text-warning"}>{keyConfigured ? "Clé OpenAI configurée" : "Clé OpenAI absente"}</p>
            <p className="text-xs text-muted-foreground">
              Modèle : {model ?? "—"} · prompt {PROMPT_VERSION}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Dernière génération</p>
            <p className="font-semibold">{last ? formatDateTime(last.created_at, tz) : "Aucune"}</p>
            {last ? <p className="text-xs text-muted-foreground">Statut : {last.status}</p> : null}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Temps de traitement (100 dernières)</p>
            <p className="font-semibold tabular-nums">{median === null ? "—" : `${(median / 1000).toFixed(1)} s médian`}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{p90 === null ? "" : `90 % sous ${(p90 / 1000).toFixed(1)} s`}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Échecs récents</p>
            <p className="font-semibold tabular-nums">
              {recentFailed} / {recentRuns.data?.length ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Sur les 100 dernières générations</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Erreurs les plus fréquentes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {topErrors.length === 0 ? (
              <p className="text-muted-foreground">Aucune génération en échec.</p>
            ) : (
              <ul className="space-y-2">
                {topErrors.map(([message, count]) => (
                  <li key={message} className="flex items-start justify-between gap-3">
                    <span className="min-w-0 break-words text-muted-foreground">{message}</span>
                    <Badge variant="destructive" className="shrink-0">
                      {count}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Chaque réponse de l&apos;IA est validée (schéma strict) avant enregistrement : une réponse invalide est refusée, jamais publiée.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Qualité des données (30 jours)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="font-heading text-2xl font-bold tabular-nums">{dossierRows.length}</span>{" "}
              <span className="text-muted-foreground">dossier(s) de match construit(s)</span>
            </p>
            <p className={dossierWithErrors > 0 ? "text-warning" : "text-success"}>
              {dossierWithErrors > 0
                ? `${dossierWithErrors} dossier(s) avec une donnée manquante (appel API-Football en échec ou non couvert).`
                : "Aucune erreur de collecte."}
            </p>
            <p className={dossierInsufficient > 0 ? "text-warning" : "text-muted-foreground"}>
              {dossierInsufficient} dossier(s) « données insuffisantes » (ni forme, ni classement, ni confrontation) : confiance limitée à « faible ».
            </p>
            <p className="text-xs text-muted-foreground">
              Chaque dossier classe ses sources en fiables, incomplètes ou indisponibles (prompt v4). Le détail est visible sur la fiche du match
              (section « Dossier envoyé à l&apos;IA »).
            </p>
          </CardContent>
        </Card>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle>Analyses à la demande (50 dernières)</CardTitle>
          <p className="text-sm text-muted-foreground">
            30 derniers jours :{" "}
            {Object.entries(onDemand.counts ?? {})
              .map(([status, count]) => `${ON_DEMAND_STATUS[status] ?? status} : ${count}`)
              .join(" · ") || "aucune"}
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Match</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Crédits</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {onDemand.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Aucune analyse à la demande.
                  </TableCell>
                </TableRow>
              ) : null}
              {onDemand.rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(r.created_at, tz)}</TableCell>
                  <TableCell>
                    <Link href={`/admin/utilisateurs/${r.user_id}`} className="underline-offset-4 hover:underline">
                      {r.display_name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/matchs/${r.fixture_id}`} className="underline-offset-4 hover:underline">
                      {r.match}
                    </Link>
                  </TableCell>
                  <TableCell>{r.market_code ?? "Analyse complète"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.price}</TableCell>
                  <TableCell className="whitespace-normal">
                    <Badge variant={r.status === "succeeded" ? "default" : r.status === "failed" ? "destructive" : "outline"}>
                      {ON_DEMAND_STATUS[r.status] ?? r.status}
                    </Badge>
                    {r.error ? <p className="text-xs text-muted-foreground">{r.error}</p> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminPage>
  );
}
