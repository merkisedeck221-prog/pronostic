import type { Metadata } from "next";
import { AdminActionForm } from "@/components/admin/action-form";
import { AdminPage, Field, inputClass, Stat } from "@/components/admin/table-tools";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { addCompetitionAction, setCompetitionOrderAction, setCompetitionSeasonAction, syncCompetitionsNowAction, toggleCompetitionAction } from "@/lib/admin/actions/competitions";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Compétitions · Administration" };

export default async function AdminCompetitionsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [{ data: competitions, error }, { data: upcoming }] = await Promise.all([
    supabase.from("competitions").select("id, api_league_id, name, category, country, current_season, is_active, sort_order, coverage").order("is_active", { ascending: false }).order("sort_order").order("name"),
    supabase.from("fixtures").select("competition_id, kickoff_at, status_short").limit(20000),
  ]);
  if (error) throw new Error(error.message);
  // Matchs en base par compétition : total, à venir, terminés.
  const counts = new Map<number, { total: number; upcoming: number; finished: number }>();
  for (const f of upcoming ?? []) {
    const c = counts.get(f.competition_id) ?? { total: 0, upcoming: 0, finished: 0 };
    c.total += 1;
    if (f.kickoff_at >= nowIso && (f.status_short === "NS" || f.status_short === "TBD")) c.upcoming += 1;
    if (["FT", "AET", "PEN"].includes(f.status_short)) c.finished += 1;
    counts.set(f.competition_id, c);
  }
  const active = (competitions ?? []).filter((c) => c.is_active).length;

  return (
    <AdminPage
      title="Compétitions"
      description="Seules les compétitions actives sont synchronisées et visibles."
      actions={
        <AdminActionForm
          action={syncCompetitionsNowAction}
          submitLabel="Synchroniser maintenant"
          pendingLabel="Synchronisation…"
          confirmMessage="Lancer sync-fixtures puis sync-standings ? Ces tâches consomment des appels API-Football."
        />
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Compétitions" value={(competitions ?? []).length} hint={`${active} active(s)`} />
        <Stat label="Matchs en base" value={(upcoming ?? []).length} />
        <Stat label="Matchs à venir" value={[...counts.values()].reduce((s, c) => s + c.upcoming, 0)} />
        <Stat label="Matchs terminés" value={[...counts.values()].reduce((s, c) => s + c.finished, 0)} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Compétition</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead className="text-right">ID API</TableHead>
              <TableHead>Saison</TableHead>
              <TableHead className="text-right">Matchs (à venir / terminés)</TableHead>
              <TableHead>Couverture API</TableHead>
              <TableHead>Ordre</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(competitions ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Aucune compétition : ajoutez-en une ci-dessous.
                </TableCell>
              </TableRow>
            ) : null}
            {(competitions ?? []).map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <span className="font-medium">{c.name}</span>
                  {c.country ? <span className="block text-xs text-muted-foreground">{c.country}</span> : null}
                </TableCell>
                <TableCell>{c.category === "international" ? "International" : "Championnat"}</TableCell>
                <TableCell className="text-right tabular-nums">{c.api_league_id}</TableCell>
                <TableCell>
                  <AdminActionForm action={setCompetitionSeasonAction} hidden={{ id: c.id }} submitLabel="OK" variant="outline" inline>
                    <input name="current_season" type="number" min={1990} max={2100} defaultValue={c.current_season ?? ""} className={`${inputClass} w-24`} aria-label={`Saison de ${c.name}`} />
                  </AdminActionForm>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {counts.get(c.id)?.total ?? 0}
                  <span className="block text-xs text-muted-foreground">
                    {counts.get(c.id)?.upcoming ?? 0} / {counts.get(c.id)?.finished ?? 0}
                  </span>
                </TableCell>
                <TableCell>
                  <CoverageTags coverage={c.coverage} />
                </TableCell>
                <TableCell>
                  <AdminActionForm action={setCompetitionOrderAction} hidden={{ id: c.id }} submitLabel="OK" variant="outline" inline>
                    <input name="sort_order" type="number" min={0} max={9999} defaultValue={c.sort_order} className={`${inputClass} w-20`} aria-label="Ordre" />
                  </AdminActionForm>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant={c.is_active ? "default" : "outline"}>{c.is_active ? "Active" : "Inactive"}</Badge>
                    <AdminActionForm
                      action={toggleCompetitionAction}
                      hidden={{ id: c.id, active: c.is_active ? "false" : "true" }}
                      submitLabel={c.is_active ? "Désactiver" : "Activer"}
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

      <Card>
        <CardHeader>
          <CardTitle>Ajouter une compétition</CardTitle>
          <CardDescription>Par son identifiant API-Football (voir docs/leagues.md). Vérification par /leagues : 1 appel.</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminActionForm action={addCompetitionAction} submitLabel="Vérifier et ajouter" pendingLabel="Vérification…" inline>
            <Field label="Identifiant API-Football">
              <input name="api_league_id" type="number" min={1} required className={`${inputClass} w-32`} />
            </Field>
            <Field label="Catégorie">
              <select name="category" className={inputClass} defaultValue="club_league">
                <option value="club_league">Championnat</option>
                <option value="international">International</option>
              </select>
            </Field>
            <Field label="Activer tout de suite">
              <select name="is_active" className={inputClass} defaultValue="false">
                <option value="false">Non</option>
                <option value="true">Oui</option>
              </select>
            </Field>
          </AdminActionForm>
        </CardContent>
      </Card>
    </AdminPage>
  );
}

const COVERAGE_LABELS: [string[], string][] = [
  [["standings"], "Classement"],
  [["fixtures", "statistics_fixtures"], "Statistiques"],
  [["injuries"], "Absences"],
  [["predictions"], "Prédictions"],
];

function coverageValue(coverage: Record<string, unknown>, path: string[]): unknown {
  return path.reduce<unknown>((node, key) => (node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined), coverage);
}

/** Données que l'offre API-Football fournit pour la saison (colonne coverage, relevée par sync-competitions). */
function CoverageTags({ coverage }: { coverage: unknown }) {
  if (!coverage || typeof coverage !== "object") return <span className="text-xs text-muted-foreground">Inconnue</span>;
  const c = coverage as Record<string, unknown>;
  return (
    <span className="inline-flex flex-wrap justify-end gap-1 md:justify-start">
      {COVERAGE_LABELS.map(([path, label]) => (
        <span
          key={label}
          className={coverageValue(c, path) === true ? "rounded-md bg-success/10 px-1.5 py-0.5 text-[11px] text-success" : "rounded-md bg-white/5 px-1.5 py-0.5 text-[11px] text-muted-foreground line-through decoration-white/30"}
        >
          {label}
        </span>
      ))}
    </span>
  );
}
