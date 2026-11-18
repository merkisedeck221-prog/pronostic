import type { Metadata } from "next";
import { AdminActionForm } from "@/components/admin/action-form";
import { AdminPage, Field, inputClass } from "@/components/admin/table-tools";
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
    supabase.from("competitions").select("id, api_league_id, name, category, country, current_season, is_active, sort_order").order("is_active", { ascending: false }).order("sort_order").order("name"),
    supabase.from("fixtures").select("competition_id").gte("kickoff_at", nowIso).limit(5000),
  ]);
  if (error) throw new Error(error.message);
  const counts = new Map<number, number>();
  for (const f of upcoming ?? []) counts.set(f.competition_id, (counts.get(f.competition_id) ?? 0) + 1);

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
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Compétition</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead className="text-right">ID API</TableHead>
              <TableHead>Saison</TableHead>
              <TableHead className="text-right">À venir</TableHead>
              <TableHead>Ordre</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(competitions ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
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
                <TableCell className="text-right tabular-nums">{counts.get(c.id) ?? 0}</TableCell>
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
