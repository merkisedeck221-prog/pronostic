import type { Metadata } from "next";
import Link from "next/link";
import { AdminPage, FilterBar, FilterInput, FilterSelect, Pagination, Stat } from "@/components/admin/table-tools";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { pageCount, pageRange, parsePageParam, parseTextParam } from "@/lib/admin/params";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, resolveTimezone } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Journal d'audit · Administration" };
const PATH = "/admin/journal";

/** Journal des actions sensibles (RG-F9-1) : qui, quoi, quand, avant, après, motif. */
const PERIOD_HOURS = { "24h": 24, "7j": 24 * 7, "30j": 24 * 30 } as const;

/** Début de la période choisie (ISO), null pour « tout ». */
function sinceFor(period: string): string | null {
  const hours = PERIOD_HOURS[period as keyof typeof PERIOD_HOURS];
  return hours ? new Date(Date.now() - hours * 3600 * 1000).toISOString() : null;
}

export default async function AdminAuditPage({ searchParams }: PageProps<"/admin/journal">) {
  const admin = await requireAdmin();
  const tz = resolveTimezone(admin.profile.timezone);
  const params = await searchParams;
  const action = parseTextParam(params.action, 60);
  const entity = typeof params.objet === "string" && /^[a-z_]{1,40}$/.test(params.objet) ? params.objet : "";
  const period = params.periode === "24h" || params.periode === "7j" || params.periode === "30j" ? params.periode : "tout";
  const page = parsePageParam(params.page);
  const range = pageRange(page);

  const supabase = await createClient();
  let query = supabase
    .from("admin_audit_log")
    .select("id, action, entity, entity_id, before, after, reason, created_at, admin_id, admin:profiles(display_name)", { count: "exact" })
    .order("created_at", { ascending: false });
  if (action) query = query.ilike("action", `%${action}%`);
  if (entity) query = query.eq("entity", entity);
  const since = sinceFor(period);
  if (since) query = query.gte("created_at", since);
  const [{ data, count, error }, { data: entities }, last24, last7] = await Promise.all([
    query.range(range.from, range.to),
    supabase.from("admin_audit_log").select("entity").order("created_at", { ascending: false }).limit(2000),
    supabase.from("admin_audit_log").select("id", { count: "exact", head: true }).gte("created_at", sinceFor("24h")!),
    supabase.from("admin_audit_log").select("id", { count: "exact", head: true }).gte("created_at", sinceFor("7j")!),
  ]);
  const entityOptions = [...new Set((entities ?? []).map((e) => e.entity))].sort();
  if (error) throw new Error(error.message);

  return (
    <AdminPage
      title="Journal d'audit"
      description="Toutes les actions sensibles des administrateurs : qui, quoi, quand, valeur avant / après et motif. Le journal ne peut être ni modifié ni effacé depuis l'application."
    >
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Actions (24 h)" value={last24.count ?? "—"} />
        <Stat label="Actions (7 jours)" value={last7.count ?? "—"} />
        <Stat label="Résultats (filtres)" value={count ?? 0} />
      </div>
      <FilterBar resetHref={PATH}>
        <FilterInput name="action" label="Action" value={action} placeholder="ex. adjust_balance" />
        <FilterSelect name="objet" label="Objet" value={entity} options={[{ value: "", label: "Tous" }, ...entityOptions.map((e) => ({ value: e, label: e }))]} />
        <FilterSelect
          name="periode"
          label="Période"
          value={period}
          options={[
            { value: "tout", label: "Tout" },
            { value: "24h", label: "24 heures" },
            { value: "7j", label: "7 jours" },
            { value: "30j", label: "30 jours" },
          ]}
        />
      </FilterBar>
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Administrateur</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Élément</TableHead>
              <TableHead>Motif</TableHead>
              <TableHead>Avant / après</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Aucune entrée.
                </TableCell>
              </TableRow>
            ) : null}
            {(data ?? []).map((e) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(e.created_at, tz)}</TableCell>
                <TableCell>
                  {e.admin_id ? (
                    <Link href={`/admin/utilisateurs/${e.admin_id}`} className="underline-offset-4 hover:underline">
                      {e.admin?.display_name ?? e.admin_id.slice(0, 8)}
                    </Link>
                  ) : (
                    "Serveur"
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">{e.action}</TableCell>
                <TableCell className="text-xs">
                  {e.entity}
                  {e.entity_id ? ` #${e.entity_id}` : ""}
                </TableCell>
                <TableCell className="max-w-56 whitespace-normal text-xs">{e.reason ?? ""}</TableCell>
                <TableCell className="max-w-96">
                  <details>
                    <summary className="cursor-pointer text-xs">Voir</summary>
                    <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify({ avant: e.before, apres: e.after }, null, 2)}</pre>
                  </details>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination path={PATH} params={params} page={page} pageCount={pageCount(count ?? 0)} total={count ?? 0} />
    </AdminPage>
  );
}
