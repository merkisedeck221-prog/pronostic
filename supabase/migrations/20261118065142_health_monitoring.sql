-- =============================================================================
-- Phase 12 — Surveillance minimale de la production
--
--   run_health_check()        service_role / Supabase Cron : calcule les
--                             anomalies et enregistre un rapport
--   admin_run_health_check()  admin : relance la vérification depuis /admin
--   health_reports            rapports (lecture admin uniquement)
--
-- Anomalies : tâche en erreur (24 h), aucune synchronisation réussie (24 h),
-- match du jour sans pronostic, quota API-Football bas, solde incohérent.
-- Planification : tous les jours à 06:07 UTC (07:07 à Porto-Novo), directement
-- en SQL (aucun appel HTTP).
-- =============================================================================

create table if not exists public.health_reports (
  id          bigint generated always as identity primary key,
  status      text not null check (status in ('ok', 'warning')),
  anomalies   jsonb not null default '[]'::jsonb check (jsonb_typeof(anomalies) = 'array'),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.health_reports is 'Rapports de surveillance quotidienne (anomalies). Lecture admin uniquement.';

create index if not exists health_reports_created_idx on public.health_reports (created_at desc);

create trigger health_reports_set_updated_at
  before update on public.health_reports
  for each row execute function public.set_updated_at();

alter table public.health_reports enable row level security;

create policy health_reports_select_admin on public.health_reports
  for select to authenticated
  using ((select public.is_admin()));

revoke insert, update, delete on public.health_reports from anon, authenticated;

-- Seuil d'alerte du quota API-Football restant (à adapter au forfait).
insert into public.app_settings (key, value, description, is_public)
values ('alert_quota_min', '200'::jsonb, 'Alerte si le quota API-Football restant passe sous ce seuil (surveillance quotidienne).', false)
on conflict (key) do nothing;

create or replace function public.run_health_check()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tz         text := 'Africa/Porto-Novo';
  v_day_start  timestamptz := (date_trunc('day', now() at time zone v_tz)) at time zone v_tz;
  v_quota_min  integer := coalesce((private.setting('alert_quota_min', '200') #>> '{}')::integer, 200);
  v_anomalies  jsonb := '[]'::jsonb;
  v_items      jsonb;
  v_count      integer;
  v_quota      record;
  v_report     record;
begin
  -- 1. Tâches en erreur sur 24 h.
  select count(*), coalesce(jsonb_agg(jsonb_build_object('job', job, 'status', status, 'at', started_at, 'error', left(error, 200)) order by started_at desc), '[]')
    into v_count, v_items
    from (select * from public.sync_runs where status in ('failed', 'partial') and started_at >= now() - interval '24 hours'
          order by started_at desc limit 10) s;
  if v_count > 0 then
    v_anomalies := v_anomalies || jsonb_build_array(jsonb_build_object(
      'type', 'failed_jobs', 'severity', 'error', 'count', v_count,
      'message', v_count || ' tâche(s) en erreur ou partielle(s) sur les dernières 24 h.', 'items', v_items));
  end if;

  -- 2. Aucune synchronisation réussie depuis 24 h.
  if not exists (select 1 from public.sync_runs where job in ('sync-fixtures', 'sync-results') and status = 'success'
                 and started_at >= now() - interval '24 hours') then
    v_anomalies := v_anomalies || jsonb_build_array(jsonb_build_object(
      'type', 'no_recent_sync', 'severity', 'error', 'count', 1,
      'message', 'Aucune synchronisation réussie (sync-fixtures ou sync-results) depuis 24 h : vérifier Supabase Cron et Vault.'));
  end if;

  -- 3. Matchs du jour (fuseau de Porto-Novo) sans pronostic publié.
  select count(*), coalesce(jsonb_agg(jsonb_build_object('fixture_id', id, 'match', label, 'kickoff_at', kickoff_at) order by kickoff_at), '[]')
    into v_count, v_items
    from (select f.id, f.kickoff_at, h.name || ' – ' || a.name as label
            from public.fixtures f
            join public.competitions c on c.id = f.competition_id and c.is_active
            join public.teams h on h.id = f.home_team_id
            join public.teams a on a.id = f.away_team_id
           where f.is_published and f.status_short in ('NS', 'TBD')
             and f.kickoff_at >= v_day_start and f.kickoff_at < v_day_start + interval '1 day'
             and not exists (select 1 from public.predictions p where p.fixture_id = f.id and p.status = 'published')
           order by f.kickoff_at limit 20) m;
  if v_count > 0 then
    v_anomalies := v_anomalies || jsonb_build_array(jsonb_build_object(
      'type', 'fixtures_without_prediction', 'severity', 'warning', 'count', v_count,
      'message', v_count || ' match(s) du jour sans pronostic.', 'items', v_items));
  end if;

  -- 4. Quota API-Football bas (dernier relevé de moins de 24 h).
  select quota_remaining, started_at into v_quota
    from public.sync_runs where quota_remaining is not null order by started_at desc limit 1;
  if found and v_quota.started_at >= now() - interval '24 hours' and v_quota.quota_remaining < v_quota_min then
    v_anomalies := v_anomalies || jsonb_build_array(jsonb_build_object(
      'type', 'low_quota', 'severity', 'warning', 'count', v_quota.quota_remaining,
      'message', 'Quota API-Football restant : ' || v_quota.quota_remaining || ' (seuil : ' || v_quota_min || ').'));
  end if;

  -- 5. Soldes incohérents (solde ≠ somme des transactions, RG-F6-4).
  select count(*), coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'balance', balance, 'ledger', ledger)), '[]')
    into v_count, v_items
    from (select w.user_id, w.balance, coalesce(t.total, 0) as ledger
            from public.wallets w
            left join (select user_id, sum(amount) as total from public.credit_transactions group by user_id) t on t.user_id = w.user_id
           where w.balance <> coalesce(t.total, 0)
           limit 20) x;
  if v_count > 0 then
    v_anomalies := v_anomalies || jsonb_build_array(jsonb_build_object(
      'type', 'balance_mismatch', 'severity', 'error', 'count', v_count,
      'message', v_count || ' portefeuille(s) dont le solde diffère de la somme des transactions.', 'items', v_items));
  end if;

  insert into public.health_reports (status, anomalies, created_by)
  values (case when jsonb_array_length(v_anomalies) = 0 then 'ok' else 'warning' end, v_anomalies, (select auth.uid()))
  returning id, status, created_at into v_report;

  -- Conservation : 90 jours.
  delete from public.health_reports where created_at < now() - interval '90 days';

  return jsonb_build_object('ok', true, 'id', v_report.id, 'status', v_report.status,
                            'created_at', v_report.created_at, 'anomalies', v_anomalies);
end;
$$;

comment on function public.run_health_check() is
  'Surveillance quotidienne : tâches en erreur, synchronisation absente, matchs du jour sans pronostic, quota bas, soldes incohérents.';

revoke all on function public.run_health_check() from public, anon, authenticated;
grant execute on function public.run_health_check() to service_role;

create or replace function public.admin_run_health_check()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then return private.forbidden(); end if;
  v_result := public.run_health_check();
  perform private.audit('run_health_check', 'health_reports', v_result ->> 'id', null,
                        jsonb_build_object('status', v_result ->> 'status'), 'Vérification manuelle');
  return v_result;
end;
$$;

revoke all on function public.admin_run_health_check() from public, anon;
grant execute on function public.admin_run_health_check() to authenticated;

select cron.schedule('health-check', '7 6 * * *', $$select public.run_health_check()$$);
