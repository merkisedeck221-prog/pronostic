import type { Metadata } from "next";
import { AdminActionForm } from "@/components/admin/action-form";
import { AdminPage, FilterBar, FilterSelect, Pagination, Stat } from "@/components/admin/table-tools";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminRunSyncJobAction } from "@/lib/admin/actions/sync";
import { first, pageCount, pageRange, parsePageParam } from "@/lib/admin/params";
import { adminRpc } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { SYNC_JOBS } from "@/lib/sync";
import { formatDateTime, resolveTimezone } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Synchronisation · Administration" };
const PATH = "/admin/synchronisation";

const JOB_HELP: Record<string, string> = {
  "sync-competitions": "~2 appels par compétition active",
  "sync-fixtures": "1 appel par compétition active",
  "sync-standings": "1 appel par compétition avec classement",
  "sync-results": "1 appel par lot de 20 matchs en cours (0 s'il n'y en a pas)",
  "build-contexts": "2 appels par match (dossiers IA)",
  "generate-predictions": "0 appel API-Football (OpenAI)",
  "settle-predictions": "0 appel (résolution et remboursements)",
};

type CronJob = { jobname: string; schedule: string; active: boolean; last_status: string | null; last_start: string | null; last_end: string | null; last_message: string | null };

export default async function AdminSyncPage({ searchParams }: PageProps<"/admin/synchronisation">) {
  const admin = await requireAdmin();
  const tz = resolveTimezone(admin.profile.timezone);
  const params = await searchParams;
  const job = first(params.tache) ?? "";
  const page = parsePageParam(params.page);
  const range = pageRange(page);

  const supabase = await createClient();
  let query = supabase.from("sync_runs").select("*", { count: "exact" }).order("started_at", { ascending: false });
  if (job) query = query.eq("job", job);
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const [runs, { data: quota }, { data: today }, cron] = await Promise.all([
    query.range(range.from, range.to),
    supabase.from("sync_runs").select("quota_remaining, started_at").not("quota_remaining", "is", null).order("started_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("sync_runs").select("api_calls").gte("started_at", startOfDay.toISOString()),
    adminRpc<{ jobs: CronJob[] }>("admin_cron_status").catch(() => ({ jobs: [] as CronJob[] })),
  ]);
  if (runs.error) throw new Error(runs.error.message);
  const callsToday = (today ?? []).reduce((sum, r) => sum + (r.api_calls ?? 0), 0);
  const jobNames = Object.keys(SYNC_JOBS);

  return (
    <AdminPage title="Synchronisation" description="Tâches planifiées (Supabase Cron) et lancements manuels.">
      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Quota API-Football restant"
          value={quota?.quota_remaining ?? "—"}
          hint={quota ? `Relevé le ${formatDateTime(quota.started_at, tz)}` : "Aucun appel enregistré"}
        />
        <Stat label="Appels aujourd'hui (UTC)" value={callsToday} hint="Plafond : API_FOOTBALL_DAILY_BUDGET" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lancement manuel</CardTitle>
          <CardDescription>Le résultat s&apos;affiche sous le bouton. Chaque lancement est journalisé.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {jobNames.map((name) => (
            <div key={name} className="space-y-1 rounded-lg border p-3">
              <p className="text-sm font-medium">{name}</p>
              <p className="text-xs text-muted-foreground">{JOB_HELP[name] ?? ""}</p>
              <AdminActionForm action={adminRunSyncJobAction} hidden={{ job: name }} submitLabel="Lancer" pendingLabel="Exécution…" variant="outline" confirmMessage={`Lancer ${name} maintenant ?`} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tâches Supabase Cron</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tâche</TableHead>
                <TableHead>Planification (UTC)</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Dernière exécution</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cron.jobs.map((j) => (
                <TableRow key={j.jobname}>
                  <TableCell className="font-medium">{j.jobname}</TableCell>
                  <TableCell className="font-mono text-xs">{j.schedule}</TableCell>
                  <TableCell>{j.active ? "Oui" : "Non"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {j.last_start ? (
                      <>
                        <Badge variant={j.last_status === "succeeded" ? "default" : "destructive"}>{j.last_status}</Badge> {formatDateTime(j.last_start, tz)}
                      </>
                    ) : (
                      "Jamais"
                    )}
                  </TableCell>
                  <TableCell className="max-w-72 truncate text-xs text-muted-foreground">{j.last_message ?? ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <FilterBar resetHref={PATH}>
        <FilterSelect name="tache" label="Tâche" value={job} options={[{ value: "", label: "Toutes" }, ...jobNames.map((n) => ({ value: n, label: n }))]} />
      </FilterBar>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Début</TableHead>
              <TableHead>Tâche</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Durée</TableHead>
              <TableHead className="text-right">Appels</TableHead>
              <TableHead className="text-right">Éléments</TableHead>
              <TableHead>Erreurs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(runs.data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Aucune exécution.
                </TableCell>
              </TableRow>
            ) : null}
            {(runs.data ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(r.started_at, tz)}</TableCell>
                <TableCell>{r.job}</TableCell>
                <TableCell>
                  <Badge variant={r.status === "success" ? "default" : r.status === "running" ? "secondary" : "destructive"}>{r.status}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.finished_at ? `${Math.round((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 100) / 10} s` : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.api_calls}</TableCell>
                <TableCell className="text-right tabular-nums">{r.items_processed}</TableCell>
                <TableCell className="max-w-80 truncate text-xs text-muted-foreground" title={r.error ?? undefined}>
                  {r.error ?? ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination path={PATH} params={params} page={page} pageCount={pageCount(runs.count ?? 0)} total={runs.count ?? 0} />
    </AdminPage>
  );
}
