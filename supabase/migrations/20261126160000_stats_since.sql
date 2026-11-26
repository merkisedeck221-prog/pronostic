-- Date de départ des statistiques (décision du porteur, 26/11/2026).
--
-- Les recharges et mouvements faits pendant les essais restent en base, intacts
-- (grand livre immuable, aucune suppression). Le réglage public `stats_since`
-- fixe le début des totaux : centre de contrôle, page Revenus et totaux du
-- portefeuille. Valeur null = tout compter (comportement précédent).
-- Les soldes (« crédits en circulation ») ne dépendent pas de cette date.

insert into public.app_settings (key, value, description, is_public)
values (
  'stats_since',
  'null'::jsonb,
  'Date de départ des statistiques de ventes et des totaux du portefeuille (les mouvements antérieurs restent consultables).',
  true
)
on conflict (key) do nothing;

-- Début des statistiques ; '-infinity' si le réglage est vide ou illisible.
create or replace function public.stats_since()
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  v_value jsonb;
begin
  select value into v_value from public.app_settings where key = 'stats_since';
  if v_value is null or jsonb_typeof(v_value) <> 'string' then
    return '-infinity'::timestamptz;
  end if;
  return (v_value #>> '{}')::timestamptz;
exception when others then
  return '-infinity'::timestamptz;
end;
$$;

comment on function public.stats_since() is
  'Début des statistiques de ventes et des totaux du portefeuille (réglage stats_since), -infinity si absent.';

-- ---------------------------------------------------------------------------
-- Centre de contrôle : ventes comptées depuis stats_since.
-- ---------------------------------------------------------------------------
create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_tz    text := 'Africa/Porto-Novo';
  v_today_start timestamptz := (date_trunc('day', now() at time zone v_tz)) at time zone v_tz;
  v_since timestamptz := public.stats_since();
begin
  if not public.is_admin() then return private.forbidden(); end if;
  return jsonb_build_object(
    'ok', true,
    'stats_since', case when v_since = '-infinity'::timestamptz then null else v_since end,
    'users_total', (select count(*) from public.profiles),
    'users_7d', (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
    'credits_sold', (select coalesce(sum(credits), 0) from public.topups where status = 'succeeded' and completed_at >= v_since),
    'credits_spent', (select coalesce(-sum(amount), 0) from public.credit_transactions where type = 'unlock' and created_at >= v_since),
    'credits_refunded', (select coalesce(sum(amount), 0) from public.credit_transactions where type = 'refund' and created_at >= v_since),
    'credits_in_circulation', (select coalesce(sum(balance), 0) from public.wallets),
    'revenue_xof', (select coalesce(sum(amount_xof), 0) from public.topups where status = 'succeeded' and completed_at >= v_since),
    'upcoming_48h_with', (
      select count(*) from public.fixtures f join public.competitions c on c.id = f.competition_id and c.is_active
       where f.is_published and f.status_short in ('NS', 'TBD') and f.kickoff_at between now() and now() + interval '48 hours'
         and exists (select 1 from public.predictions p where p.fixture_id = f.id and p.status = 'published')),
    'upcoming_48h_without', (
      select count(*) from public.fixtures f join public.competitions c on c.id = f.competition_id and c.is_active
       where f.is_published and f.status_short in ('NS', 'TBD') and f.kickoff_at between now() and now() + interval '48 hours'
         and not exists (select 1 from public.predictions p where p.fixture_id = f.id and p.status = 'published')),
    'today_without_prediction', coalesce((
      select jsonb_agg(x order by x.kickoff_at) from (
        select f.id, f.kickoff_at, h.name as home_name, a.name as away_name, c.name as competition_name
          from public.fixtures f
          join public.competitions c on c.id = f.competition_id and c.is_active
          join public.teams h on h.id = f.home_team_id
          join public.teams a on a.id = f.away_team_id
         where f.is_published and f.kickoff_at >= v_today_start and f.kickoff_at < v_today_start + interval '1 day'
           and not exists (select 1 from public.predictions p where p.fixture_id = f.id)
         order by f.kickoff_at limit 20) x), '[]'::jsonb),
    'failed_jobs', coalesce((
      select jsonb_agg(x order by x.started_at desc) from (
        select id, job, status, started_at, left(error, 300) as error from public.sync_runs
         where status in ('failed', 'partial') order by started_at desc limit 10) x), '[]'::jsonb),
    'failed_ai', coalesce((
      select jsonb_agg(x order by x.created_at desc) from (
        select id, fixture_id, model, prompt_version, created_at, left(error, 300) as error from public.ai_generation_runs
         where status = 'failed' order by created_at desc limit 10) x), '[]'::jsonb),
    'quota_remaining', (select quota_remaining from public.sync_runs where quota_remaining is not null order by started_at desc limit 1),
    'api_calls_today', (select coalesce(sum(api_calls), 0) from public.sync_runs where started_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- Revenus : la période ne commence jamais avant stats_since.
-- ---------------------------------------------------------------------------
create or replace function public.admin_revenue(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_tz    text := 'Africa/Porto-Novo';
  v_start timestamptz;
  v_end   timestamptz;
  v_since timestamptz := public.stats_since();
begin
  if not public.is_admin() then return private.forbidden(); end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 731 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Période invalide (2 ans au plus).');
  end if;
  v_start := greatest(p_from::timestamp at time zone v_tz, v_since);
  v_end   := (p_to + 1)::timestamp at time zone v_tz;
  return (
    with paid as (
      select t.*, coalesce(cp.name, 'Pack supprimé') as pack_name
        from public.topups t left join public.credit_packs cp on cp.id = t.pack_id
       where t.status = 'succeeded' and t.completed_at >= v_start and t.completed_at < v_end
    ), ledger as (
      select * from public.credit_transactions
       where created_at >= v_start and created_at < v_end
    )
    select jsonb_build_object(
      'ok', true,
      'from', p_from, 'to', p_to,
      'stats_since', case when v_since = '-infinity'::timestamptz then null else v_since end,
      'revenue_xof', (select coalesce(sum(amount_xof), 0) from paid),
      'topups', (select count(*) from paid),
      'buyers', (select count(distinct user_id) from paid),
      'credits_sold', (select coalesce(sum(credits), 0) from paid),
      'credits_consumed', (select coalesce(-sum(amount), 0) from ledger where type = 'unlock'),
      'credits_refunded', (select coalesce(sum(amount), 0) from ledger where type = 'refund'),
      'failed_topups', (select count(*) from public.topups where status in ('failed', 'cancelled')
                          and completed_at >= v_start and completed_at < v_end),
      'by_day', coalesce((
        select jsonb_agg(x order by x.day) from (
          select to_char(completed_at at time zone v_tz, 'YYYY-MM-DD') as day,
                 sum(amount_xof) as revenue_xof, count(*) as topups
            from paid group by 1) x), '[]'::jsonb),
      'by_pack', coalesce((
        select jsonb_agg(x order by x.revenue_xof desc) from (
          select pack_name, sum(amount_xof) as revenue_xof, count(*) as topups, sum(credits) as credits
            from paid group by pack_name) x), '[]'::jsonb),
      'by_provider', coalesce((
        select jsonb_agg(x order by x.revenue_xof desc) from (
          select provider, sum(amount_xof) as revenue_xof, count(*) as topups
            from paid group by provider) x), '[]'::jsonb)
    )
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- Portefeuille : totaux depuis stats_since ; mouvements antérieurs comptés à part.
-- ---------------------------------------------------------------------------
create or replace function public.get_my_wallet_summary()
returns jsonb
language sql
stable
set search_path = ''
as $function$
  with s as (select public.stats_since() as since)
  select jsonb_build_object(
    'received', coalesce(sum(t.amount) filter (where t.created_at >= s.since and t.amount > 0 and t.type <> 'refund'), 0),
    'consumed', coalesce(-sum(t.amount) filter (where t.created_at >= s.since and t.amount < 0), 0),
    'refunded', coalesce(sum(t.amount) filter (where t.created_at >= s.since and t.type = 'refund'), 0),
    'count', count(t.id) filter (where t.created_at >= s.since),
    'before_count', count(t.id) filter (where t.created_at < s.since),
    'since', case when s.since = '-infinity'::timestamptz then null else s.since end
  )
  from s left join public.credit_transactions t on t.user_id = (select auth.uid())
  group by s.since;
$function$;
