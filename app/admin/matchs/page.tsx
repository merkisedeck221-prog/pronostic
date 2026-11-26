import type { Metadata } from "next";
import Link from "next/link";
import { AdminActionForm } from "@/components/admin/action-form";
import { AdminPage, FilterBar, FilterInput, FilterSelect, Pagination, SortLink, Stat } from "@/components/admin/table-tools";
import { matchesSearch, parseSearch } from "@/lib/catalog/fixture-filters";
import { StatusBadge } from "@/components/matches/status-badge";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { setFixturePublishedAction } from "@/lib/admin/actions/matches";
import { FIXTURE_STATUS_FILTERS, PREDICTION_FILTERS, PUBLISHED_FILTERS, statusesFor } from "@/lib/admin/fixtures";
import { ADMIN_PAGE_SIZE, FIXTURE_PERIODS, fixturePeriodRange, pageCount, parseEnumParam, parseIntParam, parsePageParam } from "@/lib/admin/params";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, resolveTimezone } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Matchs · Administration" };
const PATH = "/admin/matchs";
const SORTS = ["date_asc", "date_desc"] as const;

export default async function AdminFixturesPage({ searchParams }: PageProps<"/admin/matchs">) {
  const admin = await requireAdmin();
  const tz = resolveTimezone(admin.profile.timezone);
  const params = await searchParams;
  const competition = parseIntParam(params.competition);
  const period = parseEnumParam(params.periode, FIXTURE_PERIODS, "7j");
  const status = parseEnumParam(params.statut, FIXTURE_STATUS_FILTERS, "tous");
  const prediction = parseEnumParam(params.pronostic, PREDICTION_FILTERS, "tous");
  const published = parseEnumParam(params.publie, PUBLISHED_FILTERS, "tous");
  const sort = parseEnumParam(params.tri, SORTS, period === "passes-7j" ? "date_desc" : "date_asc");
  const page = parsePageParam(params.page);
  const search = parseSearch(params.q);

  const supabase = await createClient();
  const { data: competitions } = await supabase.from("competitions").select("id, name").order("name");

  const range = fixturePeriodRange(period);
  let query = supabase
    .from("fixtures")
    .select("id, kickoff_at, status_short, is_published, goals_home, goals_away, ht_home, corners_home, cards_home, last_synced_at, competition:competitions(name), home:teams!fixtures_home_team_id_fkey(name), away:teams!fixtures_away_team_id_fkey(name)")
    .order("kickoff_at", { ascending: sort === "date_asc" })
    .limit(2000);
  if (range.from) query = query.gte("kickoff_at", range.from.toISOString());
  if (range.to) query = query.lt("kickoff_at", range.to.toISOString());
  if (competition) query = query.eq("competition_id", competition);
  const statuses = statusesFor(status);
  if (statuses) query = query.in("status_short", [...statuses]);
  if (published !== "tous") query = query.eq("is_published", published === "publies");
  const { data: fixtures, error } = await query;
  if (error) throw new Error(error.message);

  const searched = (fixtures ?? []).filter((f) => matchesSearch(search, [f.home.name, f.away.name, f.competition?.name]));
  const ids = searched.map((f) => f.id);
  const [{ data: preds }, { data: unlocks }, { data: contexts }] = await Promise.all([
    ids.length ? supabase.from("predictions").select("fixture_id, status").in("fixture_id", ids.slice(0, 1000)) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("unlocks").select("fixture_id").in("fixture_id", ids.slice(0, 1000)) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("match_contexts").select("fixture_id").in("fixture_id", ids.slice(0, 1000)) : Promise.resolve({ data: [] }),
  ]);
  const withContext = new Set((contexts ?? []).map((c) => c.fixture_id));
  const predCount = new Map<number, number>();
  for (const p of preds ?? []) predCount.set(p.fixture_id, (predCount.get(p.fixture_id) ?? 0) + 1);
  const unlockCount = new Map<number, number>();
  for (const u of unlocks ?? []) unlockCount.set(u.fixture_id, (unlockCount.get(u.fixture_id) ?? 0) + 1);

  const filtered = searched.filter((f) =>
    prediction === "avec" ? predCount.has(f.id) : prediction === "sans" ? !predCount.has(f.id) : true,
  );
  const total = filtered.length;
  const rows = filtered.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE);

  const totalUnlocks = filtered.reduce((sum, f) => sum + (unlockCount.get(f.id) ?? 0), 0);

  return (
    <AdminPage title="Matchs" description="Liste filtrable ; publier ou masquer un match. Cliquez sur un match pour ses pronostics, ses données et ses actions.">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Matchs (filtres actuels)" value={total} />
        <Stat label="Avec pronostics" value={filtered.filter((f) => predCount.has(f.id)).length} />
        <Stat label="Avec dossier IA" value={filtered.filter((f) => withContext.has(f.id)).length} hint="Données envoyées à l'IA" />
        <Stat label="Déblocages" value={totalUnlocks} />
      </div>
      <FilterBar resetHref={PATH}>
        <FilterInput name="q" label="Recherche (équipe ou compétition)" value={search} className="min-w-56" />
        <FilterSelect
          name="competition"
          label="Compétition"
          value={competition ? String(competition) : ""}
          options={[{ value: "", label: "Toutes" }, ...(competitions ?? []).map((c) => ({ value: String(c.id), label: c.name }))]}
        />
        <FilterSelect
          name="periode"
          label="Période"
          value={period}
          options={[
            { value: "48h", label: "48 prochaines heures" },
            { value: "7j", label: "7 prochains jours" },
            { value: "passes-7j", label: "7 derniers jours" },
            { value: "tout", label: "Tout" },
          ]}
        />
        <FilterSelect
          name="statut"
          label="Statut"
          value={status}
          options={[
            { value: "tous", label: "Tous" },
            { value: "a-venir", label: "À venir" },
            { value: "en-cours", label: "En cours" },
            { value: "termine", label: "Terminés" },
            { value: "annule", label: "Reportés / annulés" },
          ]}
        />
        <FilterSelect
          name="pronostic"
          label="Pronostic"
          value={prediction}
          options={[
            { value: "tous", label: "Tous" },
            { value: "avec", label: "Avec pronostic" },
            { value: "sans", label: "Sans pronostic" },
          ]}
        />
        <FilterSelect
          name="publie"
          label="Publication"
          value={published}
          options={[
            { value: "tous", label: "Tous" },
            { value: "publies", label: "Publiés" },
            { value: "masques", label: "Masqués" },
          ]}
        />
      </FilterBar>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortLink path={PATH} params={params} current={sort} asc="date_asc" desc="date_desc">
                  Coup d&apos;envoi
                </SortLink>
              </TableHead>
              <TableHead>Match</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Données</TableHead>
              <TableHead>Dernière synchro</TableHead>
              <TableHead className="text-right">Pronostics</TableHead>
              <TableHead className="text-right">Déblocages</TableHead>
              <TableHead>Publication</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Aucun match pour ces filtres.
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(f.kickoff_at, tz)}</TableCell>
                <TableCell>
                  <Link href={`/admin/matchs/${f.id}`} className="font-medium underline-offset-4 hover:underline">
                    {f.home.name} – {f.away.name}
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    {f.competition?.name}
                    {f.goals_home !== null && f.goals_away !== null ? ` · ${f.goals_home} – ${f.goals_away}` : ""}
                  </span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={f.status_short} showUpcoming />
                </TableCell>
                <TableCell>
                  <DataTags items={[
                    { label: "Dossier IA", ok: withContext.has(f.id) },
                    { label: "Score", ok: f.goals_home !== null },
                    { label: "Mi-temps", ok: f.ht_home !== null },
                    { label: "Stats", ok: f.corners_home !== null || f.cards_home !== null },
                  ]} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {f.last_synced_at ? formatDateTime(f.last_synced_at, tz) : "Jamais"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{predCount.get(f.id) ?? 0}</TableCell>
                <TableCell className="text-right tabular-nums">{unlockCount.get(f.id) ?? 0}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant={f.is_published ? "default" : "outline"}>{f.is_published ? "Publié" : "Masqué"}</Badge>
                    <AdminActionForm
                      action={setFixturePublishedAction}
                      hidden={{ fixtureId: f.id, published: f.is_published ? "false" : "true" }}
                      submitLabel={f.is_published ? "Masquer" : "Publier"}
                      variant="outline"
                      inline
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination path={PATH} params={params} page={page} pageCount={pageCount(total)} total={total} />
    </AdminPage>
  );
}

/** Disponibilité des données d'un match : pastille verte si présente, grise sinon. */
function DataTags({ items }: { items: { label: string; ok: boolean }[] }) {
  return (
    <span className="inline-flex flex-wrap justify-end gap-1 md:justify-start">
      {items.map((item) => (
        <span
          key={item.label}
          className={item.ok ? "rounded-md bg-success/10 px-1.5 py-0.5 text-[11px] text-success" : "rounded-md bg-white/5 px-1.5 py-0.5 text-[11px] text-muted-foreground line-through decoration-white/30"}
          title={item.ok ? `${item.label} : disponible` : `${item.label} : absent`}
        >
          {item.label}
        </span>
      ))}
    </span>
  );
}
