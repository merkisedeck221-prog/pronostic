import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminActionForm } from "@/components/admin/action-form";
import { AdminPage, Field, Stat, inputClass } from "@/components/admin/table-tools";
import { StatusBadge } from "@/components/matches/status-badge";
import { PredictionResultBadge } from "@/components/settle/result-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  editPredictionTextAction,
  generateNowAction,
  refundFixtureAction,
  regenerateFixtureAction,
  setFixturePublishedAction,
  setPredictionStatusAction,
  settleNowAction,
} from "@/lib/admin/actions/matches";
import { requireAdmin } from "@/lib/auth/session";
import { getFixtureContext } from "@/lib/catalog/queries";
import { confidenceLabel } from "@/lib/credits/labels";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, resolveTimezone } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Détail d'un match · Administration" };

export default async function AdminFixturePage({ params }: PageProps<"/admin/matchs/[id]">) {
  const admin = await requireAdmin();
  const tz = resolveTimezone(admin.profile.timezone);
  const { id: raw } = await params;
  if (!/^\d{1,12}$/.test(raw)) notFound();
  const id = Number(raw);

  const supabase = await createClient();
  const { data: fixture } = await supabase
    .from("fixtures")
    .select("*, competition:competitions(name, slug), home:teams!fixtures_home_team_id_fkey(name), away:teams!fixtures_away_team_id_fkey(name)")
    .eq("id", id)
    .maybeSingle();
  if (!fixture) notFound();

  const [{ data: context }, { data: predictions }, { data: analysis }, { data: unlocks }, { data: runs }, publicContext] = await Promise.all([
    supabase.from("match_contexts").select("summary, fetched_at").eq("fixture_id", id).maybeSingle(),
    supabase.from("predictions").select("*, market:markets(label, sort_order)").eq("fixture_id", id).order("market_code"),
    supabase.from("prediction_analyses").select("summary, key_factors, model, prompt_version").eq("fixture_id", id).maybeSingle(),
    supabase.from("unlocks").select("credits_spent, refunded_at, market_code").eq("fixture_id", id),
    supabase.from("ai_generation_runs").select("id, status, model, prompt_version, created_at, input_tokens, output_tokens, cost_estimate_usd, duration_ms, error").eq("fixture_id", id).order("created_at", { ascending: false }).limit(10),
    getFixtureContext(id),
  ]);
  const predictionIds = (predictions ?? []).map((p) => p.id);
  const { data: revisions } = predictionIds.length
    ? await supabase.from("prediction_revisions").select("id, prediction_id, reason, created_at, previous").in("prediction_id", predictionIds).order("created_at", { ascending: false }).limit(20)
    : { data: [] };

  const sorted = [...(predictions ?? [])].sort((a, b) => (a.market?.sort_order ?? 0) - (b.market?.sort_order ?? 0));
  const unlockCount = unlocks?.length ?? 0;
  const credits = (unlocks ?? []).filter((u) => !u.refunded_at).reduce((s, u) => s + u.credits_spent, 0);
  const refunded = (unlocks ?? []).filter((u) => u.refunded_at).length;
  const hasPredictions = sorted.length > 0;

  return (
    <AdminPage
      title={`${fixture.home.name} – ${fixture.away.name}`}
      description={`${fixture.competition?.name ?? ""} · ${formatDateTime(fixture.kickoff_at, tz)}${fixture.venue ? ` · ${fixture.venue}` : ""}`}
      actions={
        <Link href={`/matchs/${id}`} className="text-sm underline-offset-4 hover:underline">
          Voir la fiche publique
        </Link>
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Statut" value={<StatusBadge status={fixture.status_short} showUpcoming />} hint={fixture.status_long ?? undefined} />
        <Stat
          label="Score (temps réglementaire)"
          value={fixture.ft_home !== null && fixture.ft_away !== null ? `${fixture.ft_home} – ${fixture.ft_away}` : "—"}
          hint={fixture.goals_home !== null ? `Final : ${fixture.goals_home} – ${fixture.goals_away}` : undefined}
        />
        <Stat label="Déblocages" value={unlockCount} hint={refunded ? `${refunded} remboursé(s)` : undefined} />
        <Stat label="Crédits encaissés" value={credits} hint="Hors remboursements" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Données disponibles</CardTitle>
          <CardDescription>
            Ce que la base contient pour ce match (synchronisation API-Football) ; dernière synchronisation :{" "}
            {fixture.last_synced_at ? formatDateTime(fixture.last_synced_at, tz) : "jamais"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Dossier IA", ok: Boolean(context), detail: context ? `Construit le ${formatDateTime(context.fetched_at, tz)}` : "Non construit" },
              {
                label: "Forme récente",
                ok: Boolean(publicContext && (publicContext.home.form.length > 0 || publicContext.away.form.length > 0)),
                detail: publicContext ? `${publicContext.home.form.length} / ${publicContext.away.form.length} match(s) en base` : "—",
              },
              { label: "Classement", ok: Boolean(publicContext?.has_standings), detail: publicContext?.has_standings ? "Disponible" : "Absent" },
              { label: "Confrontations", ok: (publicContext?.head_to_head.length ?? 0) > 0, detail: `${publicContext?.head_to_head.length ?? 0} rencontre(s)` },
              {
                label: "Corners / cartons (moyennes)",
                ok: Boolean(publicContext?.home.stats || publicContext?.away.stats),
                detail: `${publicContext?.home.stats?.matches ?? 0} / ${publicContext?.away.stats?.matches ?? 0} match(s) avec statistiques`,
              },
              {
                label: "Absences",
                ok: Boolean(publicContext?.home.absences || publicContext?.away.absences),
                detail:
                  publicContext?.home.absences || publicContext?.away.absences
                    ? `${publicContext?.home.absences?.length ?? 0} / ${publicContext?.away.absences?.length ?? 0} signalée(s)`
                    : "Inconnues",
              },
              { label: "Score et mi-temps", ok: fixture.ft_home !== null, detail: fixture.ht_home !== null ? `Mi-temps ${fixture.ht_home} – ${fixture.ht_away}` : "—" },
              {
                label: "Statistiques du match",
                ok: fixture.corners_home !== null || fixture.cards_home !== null,
                detail: fixture.corners_home !== null ? `Corners ${fixture.corners_home} – ${fixture.corners_away}` : "—",
              },
            ].map((item) => (
              <li key={item.label} className={`rounded-lg border p-3 ${item.ok ? "border-success/30 bg-success/5" : "border-white/10 bg-white/[0.02]"}`}>
                <p className={`text-xs font-semibold ${item.ok ? "text-success" : "text-muted-foreground"}`}>{item.ok ? "✓" : "—"} {item.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Actions sur le match</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium">Publication : {fixture.is_published ? "publié" : "masqué"}</p>
            <AdminActionForm
              action={setFixturePublishedAction}
              hidden={{ fixtureId: id, published: fixture.is_published ? "false" : "true" }}
              submitLabel={fixture.is_published ? "Masquer le match" : "Publier le match"}
              variant="outline"
            />
          </div>

          {hasPredictions ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Régénérer les pronostics</p>
              {unlockCount > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Impossible : ce match a déjà été acheté ({unlockCount} déblocage{unlockCount > 1 ? "s" : ""}). Les pronostics sont
                  figés (RG-F5-6) ; seul le texte de l&apos;explication peut être corrigé.
                </p>
              ) : (
                <AdminActionForm
                  action={regenerateFixtureAction}
                  hidden={{ fixtureId: id }}
                  submitLabel="Régénérer"
                  pendingLabel="Génération…"
                  confirmMessage="Reconstruire le dossier et régénérer les pronostics ? L'ancienne version sera archivée."
                >
                  <Field label="Motif">
                    <input name="reason" required minLength={3} className={inputClass} placeholder="Ex. données de forme incomplètes" />
                  </Field>
                </AdminActionForm>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium">Aucun pronostic</p>
              <AdminActionForm
                action={generateNowAction}
                hidden={{ fixtureId: id }}
                submitLabel="Générer maintenant"
                pendingLabel="Génération…"
                confirmMessage="Construire le dossier (appels API-Football) et générer les pronostics (OpenAI) ?"
              />
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">Résoudre maintenant</p>
            <p className="text-xs text-muted-foreground">Uniquement si le match est terminé (FT, AET, PEN) avec un score.</p>
            <AdminActionForm action={settleNowAction} hidden={{ fixtureId: id }} submitLabel="Résoudre" variant="outline" />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Rembourser le match</p>
            <p className="text-xs text-muted-foreground">
              Rembourse tous les déblocages non remboursés et annule les pronostics en attente, quel que soit le statut.
            </p>
            <AdminActionForm
              action={refundFixtureAction}
              hidden={{ fixtureId: id }}
              submitLabel="Rembourser"
              variant="destructive"
              confirmMessage="Rembourser tous les acheteurs de ce match ? Cette action est irréversible."
            >
              <Field label="Motif (obligatoire)">
                <input name="reason" required minLength={3} className={inputClass} />
              </Field>
              <Field label="Tapez REMBOURSER pour confirmer">
                <input name="confirm" required className={inputClass} autoComplete="off" />
              </Field>
            </AdminActionForm>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pronostics générés</CardTitle>
          {analysis ? (
            <CardDescription>
              {analysis.model} · prompt {analysis.prompt_version}
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasPredictions ? <p className="text-sm text-muted-foreground">Aucun pronostic pour ce match.</p> : null}
          {sorted.map((p) => (
            <div key={p.id} className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{p.market?.label ?? p.market_code}</span>
                <span>· {p.selection_label}</span>
                <span className="text-sm text-muted-foreground tabular-nums">· {p.probability} %</span>
                <Badge variant="secondary">Confiance : {confidenceLabel(p.confidence)}</Badge>
                <Badge variant={p.status === "published" ? "default" : "outline"}>{p.status === "published" ? "Publié" : "Masqué"}</Badge>
                <PredictionResultBadge result={p.result} />
                {p.is_locked ? <Badge variant="outline">Figé (acheté)</Badge> : null}
                <span className="text-xs text-muted-foreground">v{p.version}</span>
              </div>
              {p.probabilities ? (
                <p className="text-xs text-muted-foreground">Probabilités 1N2 : {JSON.stringify(p.probabilities)}</p>
              ) : null}
              <AdminActionForm
                action={setPredictionStatusAction}
                hidden={{ predictionId: p.id, fixtureId: id, status: p.status === "published" ? "hidden" : "published" }}
                submitLabel={p.status === "published" ? "Masquer ce marché" : "Réafficher ce marché"}
                variant="outline"
                inline
              />
              <details>
                <summary className="cursor-pointer text-sm">Modifier le texte de l&apos;explication</summary>
                <AdminActionForm action={editPredictionTextAction} hidden={{ predictionId: p.id, fixtureId: id }} submitLabel="Enregistrer le texte" className="mt-2">
                  <textarea name="reasoning" defaultValue={p.reasoning} minLength={20} maxLength={2000} rows={4} className="w-full rounded-md border bg-background p-2 text-sm" />
                  <Field label="Motif de la modification">
                    <input name="reason" required minLength={3} className={inputClass} placeholder="Ex. faute de frappe" />
                  </Field>
                </AdminActionForm>
              </details>
              <p className="text-sm text-muted-foreground">{p.reasoning}</p>
            </div>
          ))}
          {analysis ? (
            <div className="space-y-1 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm">
              <p className="font-medium">Analyse globale</p>
              <p className="text-muted-foreground">{analysis.summary}</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {(Array.isArray(analysis.key_factors) ? analysis.key_factors : []).map((f, i) => (
                  <li key={i}>{String(f)}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dossier envoyé à l&apos;IA</CardTitle>
          <CardDescription>{context ? `Construit le ${formatDateTime(context.fetched_at, tz)}` : "Aucun dossier."}</CardDescription>
        </CardHeader>
        {context ? (
          <CardContent>
            <details>
              <summary className="cursor-pointer text-sm">Afficher le JSON</summary>
              <pre className="mt-2 max-h-[32rem] overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(context.summary, null, 2)}</pre>
            </details>
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm lg:grid-cols-2">
          <section className="space-y-1">
            <p className="font-medium">Générations IA</p>
            {(runs ?? []).length === 0 ? <p className="text-muted-foreground">Aucune.</p> : null}
            {(runs ?? []).map((r) => (
              <p key={r.id} className="text-xs">
                {formatDateTime(r.created_at, tz)} · {r.status} · {r.model} · {r.prompt_version} · {(r.input_tokens ?? 0) + (r.output_tokens ?? 0)} tokens
                {r.cost_estimate_usd !== null ? ` · ${r.cost_estimate_usd} $` : ""}{r.duration_ms !== null ? ` · ${(r.duration_ms / 1000).toFixed(1)} s` : ""}
                {r.error ? <span className="block truncate text-muted-foreground">{r.error}</span> : null}
              </p>
            ))}
          </section>
          <section className="space-y-1">
            <p className="font-medium">Révisions des pronostics</p>
            {(revisions ?? []).length === 0 ? <p className="text-muted-foreground">Aucune.</p> : null}
            {(revisions ?? []).map((r) => (
              <p key={r.id} className="text-xs">
                {formatDateTime(r.created_at, tz)} · pronostic {r.prediction_id} · {r.reason ?? "—"}
              </p>
            ))}
          </section>
        </CardContent>
      </Card>
    </AdminPage>
  );
}
