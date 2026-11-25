import type { Metadata } from "next";
import Link from "next/link";
import { AdminPage, FilterBar, FilterSelect, Pagination, Stat } from "@/components/admin/table-tools";
import { PredictionResultBadge } from "@/components/settle/result-badge";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ADMIN_PAGE_SIZE, pageCount, pageRange, parseEnumParam, parseIntParam, parsePageParam } from "@/lib/admin/params";
import { requireAdmin } from "@/lib/auth/session";
import { confidenceLabel } from "@/lib/credits/labels";
import { formatRate } from "@/lib/settle/labels";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, resolveTimezone } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Pronostics · Administration" };
const PATH = "/admin/pronostics";
const STATUSES = ["tous", "published", "hidden"] as const;
const RESULTS = ["tous", "pending", "won", "lost", "void"] as const;
const CONFIDENCES = ["tous", "low", "medium", "high"] as const;

export default async function AdminPredictionsPage({ searchParams }: PageProps<"/admin/pronostics">) {
  const admin = await requireAdmin();
  const tz = resolveTimezone(admin.profile.timezone);
  const params = await searchParams;
  const market = typeof params.marche === "string" && /^[A-Z0-9_]{1,40}$/.test(params.marche) ? params.marche : "";
  const competition = parseIntParam(params.competition);
  const status = parseEnumParam(params.statut, STATUSES, "tous");
  const result = parseEnumParam(params.resultat, RESULTS, "tous");
  const confidence = parseEnumParam(params.confiance, CONFIDENCES, "tous");
  const page = parsePageParam(params.page);

  const supabase = await createClient();
  const [{ data: markets }, { data: competitions }] = await Promise.all([
    supabase.from("markets").select("code, label").order("sort_order"),
    supabase.from("competitions").select("id, name").order("name"),
  ]);

  // Même filtre pour la liste et pour le taux de réussite.
  const filtered = (select: string, options?: { count: "exact"; head?: boolean }) => {
    let q = supabase.from("predictions").select(select, options);
    if (market) q = q.eq("market_code", market);
    if (competition) q = q.eq("fixture.competition_id", competition);
    if (status !== "tous") q = q.eq("status", status);
    if (confidence !== "tous") q = q.eq("confidence", confidence);
    return q;
  };
  const fixtureJoin = competition ? "fixture:fixtures!inner(competition_id)" : "fixture:fixtures(competition_id)";

  const { from, to } = pageRange(page);
  let listQuery = filtered(
    `id, market_code, selection_label, probability, confidence, status, result, is_locked, created_at, fixture_id, ${competition ? "fixture:fixtures!inner" : "fixture:fixtures"}(kickoff_at, competition_id, competition:competitions(name), home:teams!fixtures_home_team_id_fkey(name), away:teams!fixtures_away_team_id_fkey(name))`,
    { count: "exact" },
  );
  if (result !== "tous") listQuery = listQuery.eq("result", result);
  const [list, won, lost] = await Promise.all([
    listQuery.order("created_at", { ascending: false }).range(from, to),
    result === "tous" || result === "won" ? filtered(`id, ${fixtureJoin}`, { count: "exact", head: true }).eq("result", "won") : Promise.resolve({ count: 0 }),
    result === "tous" || result === "lost" ? filtered(`id, ${fixtureJoin}`, { count: "exact", head: true }).eq("result", "lost") : Promise.resolve({ count: 0 }),
  ]);
  if ("error" in list && list.error) throw new Error(list.error.message);
  type Row = {
    id: number;
    market_code: string;
    selection_label: string;
    probability: number;
    confidence: "low" | "medium" | "high";
    status: "published" | "hidden";
    result: "pending" | "won" | "lost" | "void";
    is_locked: boolean;
    fixture_id: number;
    fixture: { kickoff_at: string; competition: { name: string } | null; home: { name: string }; away: { name: string } } | null;
  };
  const rows = (list.data ?? []) as unknown as Row[];
  const total = list.count ?? 0;
  const wonCount = won.count ?? 0;
  const lostCount = lost.count ?? 0;
  const marketLabel = new Map((markets ?? []).map((m) => [m.code, m.label]));

  return (
    <AdminPage title="Pronostics" description="Tous les pronostics, publiés ou masqués.">
      <FilterBar resetHref={PATH}>
        <FilterSelect name="marche" label="Marché" value={market} options={[{ value: "", label: "Tous" }, ...(markets ?? []).map((m) => ({ value: m.code, label: m.label }))]} />
        <FilterSelect
          name="competition"
          label="Compétition"
          value={competition ? String(competition) : ""}
          options={[{ value: "", label: "Toutes" }, ...(competitions ?? []).map((c) => ({ value: String(c.id), label: c.name }))]}
        />
        <FilterSelect name="statut" label="Statut" value={status} options={[{ value: "tous", label: "Tous" }, { value: "published", label: "Publiés" }, { value: "hidden", label: "Masqués" }]} />
        <FilterSelect
          name="resultat"
          label="Résultat"
          value={result}
          options={[
            { value: "tous", label: "Tous" },
            { value: "pending", label: "En attente" },
            { value: "won", label: "Gagnés" },
            { value: "lost", label: "Perdus" },
            { value: "void", label: "Annulés" },
          ]}
        />
        <FilterSelect
          name="confiance"
          label="Confiance"
          value={confidence}
          options={[{ value: "tous", label: "Toutes" }, { value: "low", label: "Faible" }, { value: "medium", label: "Moyen" }, { value: "high", label: "Élevé" }]}
        />
      </FilterBar>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Taux de réussite (filtre courant)" value={formatRate(wonCount, lostCount)} hint="Gagnés / (gagnés + perdus)" />
        <Stat label="Gagnés" value={wonCount} />
        <Stat label="Perdus" value={lostCount} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Match</TableHead>
              <TableHead>Marché</TableHead>
              <TableHead>Sélection</TableHead>
              <TableHead className="text-right">Proba.</TableHead>
              <TableHead>Confiance</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Résultat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Aucun pronostic pour ces filtres.
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link href={`/admin/matchs/${p.fixture_id}`} className="font-medium underline-offset-4 hover:underline">
                    {p.fixture ? `${p.fixture.home.name} – ${p.fixture.away.name}` : `Match ${p.fixture_id}`}
                  </Link>
                  {p.fixture ? (
                    <span className="block text-xs text-muted-foreground">
                      {p.fixture.competition?.name} · {formatDateTime(p.fixture.kickoff_at, tz)}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>{marketLabel.get(p.market_code) ?? p.market_code}</TableCell>
                <TableCell className="whitespace-normal">{p.selection_label}</TableCell>
                <TableCell className="text-right tabular-nums">{p.probability} %</TableCell>
                <TableCell>{confidenceLabel(p.confidence)}</TableCell>
                <TableCell>
                  <Badge variant={p.status === "published" ? "default" : "outline"}>{p.status === "published" ? "Publié" : "Masqué"}</Badge>
                  {p.is_locked ? <span className="ml-1 text-xs text-muted-foreground">figé</span> : null}
                </TableCell>
                <TableCell>
                  <PredictionResultBadge result={p.result} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination path={PATH} params={params} page={page} pageCount={pageCount(total, ADMIN_PAGE_SIZE)} total={total} />
    </AdminPage>
  );
}
