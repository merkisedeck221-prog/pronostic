-- =============================================================================
-- Phase 10 — Administration (sections 3, 4, 5-F9, 6 et 8)
--
-- Fonctions réservées aux administrateurs : SECURITY DEFINER, search_path
-- fixé, contrôle is_admin() en tête (sinon { ok:false, code:'FORBIDDEN' }),
-- auteur = auth.uid(). Exécutables par `authenticated` uniquement.
-- Toute action sensible écrit dans admin_audit_log (RG-F9-1).
-- Les autres écritures de l'admin (compétitions, matchs, tarifs, packs,
-- paramètres, marchés) passent par la RLS admin existante, suivies de
-- admin_log_action().
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers privés
-- -----------------------------------------------------------------------------
create or replace function private.forbidden()
returns jsonb
language sql
immutable
set search_path = ''
as $$ select jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Action réservée aux administrateurs.'); $$;

create or replace function private.audit(p_action text, p_entity text, p_entity_id text, p_before jsonb, p_after jsonb, p_reason text)
returns bigint
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.admin_audit_log (admin_id, action, entity, entity_id, before, after, reason)
  values ((select auth.uid()), p_action, p_entity, p_entity_id, p_before, p_after, nullif(left(btrim(coalesce(p_reason, '')), 500), ''))
  returning id;
$$;

revoke all on function private.forbidden() from public, anon, authenticated;
revoke all on function private.audit(text, text, text, jsonb, jsonb, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- admin_log_action : journal d'audit des actions faites par la RLS admin.
-- -----------------------------------------------------------------------------
create or replace function public.admin_log_action(
  p_action text, p_entity text, p_entity_id text, p_before jsonb, p_after jsonb, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then return private.forbidden(); end if;
  if coalesce(btrim(p_action), '') = '' or coalesce(btrim(p_entity), '') = '' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end if;
  return jsonb_build_object('ok', true, 'id',
    private.audit(left(p_action, 80), left(p_entity, 80), left(p_entity_id, 200), p_before, p_after, p_reason));
end;
$$;

-- -----------------------------------------------------------------------------
-- admin_overview : chiffres de la vue d'ensemble.
-- -----------------------------------------------------------------------------
create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz    text := 'Africa/Porto-Novo';
  v_today_start timestamptz := (date_trunc('day', now() at time zone v_tz)) at time zone v_tz;
begin
  if not public.is_admin() then return private.forbidden(); end if;
  return jsonb_build_object(
    'ok', true,
    'users_total', (select count(*) from public.profiles),
    'users_7d', (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
    'credits_sold', (select coalesce(sum(credits + bonus_credits), 0) from public.topups where status = 'succeeded'),
    'credits_spent', (select coalesce(-sum(amount), 0) from public.credit_transactions where type = 'unlock'),
    'credits_refunded', (select coalesce(sum(amount), 0) from public.credit_transactions where type = 'refund'),
    'credits_in_circulation', (select coalesce(sum(balance), 0) from public.wallets),
    'revenue_xof', (select coalesce(sum(amount_xof), 0) from public.topups where status = 'succeeded'),
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
$$;

-- -----------------------------------------------------------------------------
-- Utilisateurs (l'e-mail est dans auth.users, inaccessible par l'API).
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_users(
  p_search text default null, p_status text default 'all', p_sort text default 'created_desc',
  p_limit integer default 25, p_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_limit  integer := greatest(1, least(coalesce(p_limit, 25), 200));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_total  bigint;
  v_rows   jsonb;
begin
  if not public.is_admin() then return private.forbidden(); end if;

  with base as (
    select p.id, u.email::text as email, p.display_name, p.country, p.role, p.is_banned, p.created_at,
           coalesce(w.balance, 0) as balance,
           (select count(*) from public.unlocks x where x.user_id = p.id) as unlocks,
           (select count(*) from public.topups t where t.user_id = p.id and t.status = 'succeeded') as topups
      from public.profiles p
      join auth.users u on u.id = p.id
      left join public.wallets w on w.user_id = p.id
     where (v_search is null
            or u.email ilike '%' || v_search || '%'
            or p.display_name ilike '%' || v_search || '%'
            or p.id::text = v_search)
       and (coalesce(p_status, 'all') = 'all'
            or (p_status = 'banned' and p.is_banned)
            or (p_status = 'active' and not p.is_banned)
            or (p_status = 'admin' and p.role = 'admin'))
  )
  select (select count(*) from base),
         coalesce((select jsonb_agg(row_to_json(x)) from (
           select * from base
            order by
              case when p_sort = 'balance_desc' then balance end desc nulls last,
              case when p_sort = 'balance_asc' then balance end asc nulls last,
              case when p_sort = 'name' then lower(display_name) end asc,
              case when p_sort = 'created_asc' then created_at end asc,
              created_at desc
            limit v_limit offset v_offset) x), '[]'::jsonb)
    into v_total, v_rows;

  return jsonb_build_object('ok', true, 'total', v_total, 'rows', v_rows);
end;
$$;

create or replace function public.admin_get_user(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
begin
  if not public.is_admin() then return private.forbidden(); end if;
  select jsonb_build_object(
           'id', p.id, 'email', u.email, 'display_name', p.display_name, 'country', p.country, 'phone', p.phone,
           'timezone', p.timezone, 'role', p.role, 'is_banned', p.is_banned, 'created_at', p.created_at,
           'last_sign_in_at', u.last_sign_in_at, 'email_confirmed_at', u.email_confirmed_at,
           'balance', coalesce(w.balance, 0),
           'ledger_sum', (select coalesce(sum(t.amount), 0) from public.credit_transactions t where t.user_id = p.id))
    into v_row
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.wallets w on w.user_id = p.id
   where p.id = p_user_id;
  if v_row is null then return jsonb_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  return jsonb_build_object('ok', true, 'user', v_row);
end;
$$;

-- Suspension / réactivation et rôle : jamais sur soi-même, motif obligatoire, journalisé.
create or replace function public.admin_set_user_banned(p_user_id uuid, p_banned boolean, p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old boolean;
begin
  if not public.is_admin() then return private.forbidden(); end if;
  if p_user_id = (select auth.uid()) then
    return jsonb_build_object('ok', false, 'code', 'SELF', 'message', 'Vous ne pouvez pas modifier votre propre compte.');
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Un motif est obligatoire.');
  end if;
  select is_banned into v_old from public.profiles where id = p_user_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  update public.profiles set is_banned = p_banned where id = p_user_id;
  perform private.audit(case when p_banned then 'ban_user' else 'unban_user' end, 'profiles', p_user_id::text,
                        jsonb_build_object('is_banned', v_old), jsonb_build_object('is_banned', p_banned), p_reason);
  return jsonb_build_object('ok', true, 'is_banned', p_banned);
end;
$$;

create or replace function public.admin_set_user_role(p_user_id uuid, p_role public.user_role, p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.user_role;
begin
  if not public.is_admin() then return private.forbidden(); end if;
  if p_user_id = (select auth.uid()) then
    return jsonb_build_object('ok', false, 'code', 'SELF', 'message', 'Vous ne pouvez pas modifier votre propre rôle.');
  end if;
  if p_role is null or char_length(btrim(coalesce(p_reason, ''))) < 3 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Rôle et motif obligatoires.');
  end if;
  select role into v_old from public.profiles where id = p_user_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  update public.profiles set role = p_role where id = p_user_id;
  perform private.audit('set_user_role', 'profiles', p_user_id::text,
                        jsonb_build_object('role', v_old), jsonb_build_object('role', p_role), p_reason);
  return jsonb_build_object('ok', true, 'role', p_role);
end;
$$;

-- -----------------------------------------------------------------------------
-- Pronostics : texte (historisé), statut (masquer / réafficher).
-- -----------------------------------------------------------------------------
create or replace function public.admin_edit_prediction_text(p_prediction_id bigint, p_reasoning text, p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old record;
  v_text text := btrim(coalesce(p_reasoning, ''));
begin
  if not public.is_admin() then return private.forbidden(); end if;
  if char_length(v_text) < 20 or char_length(v_text) > 2000 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'L''explication doit faire entre 20 et 2 000 caractères.');
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Un motif est obligatoire.');
  end if;
  select id, fixture_id, market_code, reasoning, version, is_locked into v_old
    from public.predictions where id = p_prediction_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  if v_old.reasoning = v_text then return jsonb_build_object('ok', true, 'unchanged', true); end if;

  -- Seule l'explication change : sélection et probabilités restent figées (RG-F5-6).
  insert into public.prediction_revisions (prediction_id, previous, changed_by, reason)
  values (v_old.id, jsonb_build_object('reasoning', v_old.reasoning, 'version', v_old.version, 'kind', 'text_edit'),
          (select auth.uid()), left(btrim(p_reason), 500));
  update public.predictions set reasoning = v_text where id = v_old.id;
  perform private.audit('edit_prediction_text', 'predictions', v_old.id::text,
                        jsonb_build_object('reasoning', v_old.reasoning), jsonb_build_object('reasoning', v_text), p_reason);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_set_prediction_status(p_prediction_id bigint, p_status public.prediction_status, p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.prediction_status;
begin
  if not public.is_admin() then return private.forbidden(); end if;
  if p_status is null then return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT'); end if;
  select status into v_old from public.predictions where id = p_prediction_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  update public.predictions set status = p_status where id = p_prediction_id;
  perform private.audit(case when p_status = 'hidden' then 'hide_prediction' else 'show_prediction' end, 'predictions',
                        p_prediction_id::text, jsonb_build_object('status', v_old), jsonb_build_object('status', p_status), p_reason);
  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

-- -----------------------------------------------------------------------------
-- Matchs : résoudre maintenant, rembourser (motif obligatoire, tout statut).
-- -----------------------------------------------------------------------------
create or replace function public.admin_settle_fixture(p_fixture_id bigint)
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
  v_result := public.settle_fixture(p_fixture_id);
  perform private.audit('settle_fixture', 'fixtures', p_fixture_id::text, null, v_result, 'Résolution manuelle');
  return v_result;
end;
$$;

create or replace function public.admin_refund_fixture(p_fixture_id bigint, p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_fixture  record;
  v_unlock   record;
  v_balance  integer;
  v_refunded integer := 0;
  v_credits  integer := 0;
  v_voided   integer := 0;
  v_result   jsonb;
begin
  if not public.is_admin() then return private.forbidden(); end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Un motif est obligatoire.');
  end if;

  select f.id, h.name as home_name, a.name as away_name into v_fixture
    from public.fixtures f
    join public.teams h on h.id = f.home_team_id
    join public.teams a on a.id = f.away_team_id
   where f.id = p_fixture_id for update of f;
  if not found then return jsonb_build_object('ok', false, 'code', 'NOT_FOUND'); end if;

  -- Même logique que refund_fixture, sans condition de statut (décision de l'admin).
  for v_unlock in
    select u.id, u.user_id, u.credits_spent from public.unlocks u
     where u.fixture_id = p_fixture_id and u.refunded_at is null
     order by u.user_id, u.id
     for update
  loop
    if v_unlock.credits_spent > 0 then
      select w.balance into v_balance from public.wallets w where w.user_id = v_unlock.user_id for update;
      update public.wallets set balance = v_balance + v_unlock.credits_spent where user_id = v_unlock.user_id;
      insert into public.credit_transactions (user_id, type, amount, balance_after, reference_type, reference_id, description, created_by)
      values (v_unlock.user_id, 'refund', v_unlock.credits_spent, v_balance + v_unlock.credits_spent, 'fixture', p_fixture_id::text,
              'Remboursement : ' || v_fixture.home_name || ' – ' || v_fixture.away_name || ' (décision de l''administration)',
              (select auth.uid()));
      v_credits := v_credits + v_unlock.credits_spent;
    end if;
    update public.unlocks set refunded_at = now() where id = v_unlock.id;
    v_refunded := v_refunded + 1;
  end loop;

  update public.predictions set result = 'void', settled_at = now()
   where fixture_id = p_fixture_id and result = 'pending';
  get diagnostics v_voided = row_count;

  v_result := jsonb_build_object('ok', true, 'refunded_unlocks', v_refunded, 'refunded_credits', v_credits, 'voided', v_voided);
  perform private.audit('refund_fixture', 'fixtures', p_fixture_id::text, null, v_result, p_reason);
  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Contrôle de cohérence (RG-F6-4) : solde ≠ somme des transactions.
-- -----------------------------------------------------------------------------
create or replace function public.admin_consistency_check()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then return private.forbidden(); end if;
  return jsonb_build_object('ok', true, 'checked', (select count(*) from public.wallets), 'rows', coalesce((
    select jsonb_agg(x order by abs(x.difference) desc) from (
      select w.user_id, u.email, p.display_name, w.balance, coalesce(t.total, 0) as ledger,
             w.balance - coalesce(t.total, 0) as difference
        from public.wallets w
        join public.profiles p on p.id = w.user_id
        join auth.users u on u.id = w.user_id
        left join (select user_id, sum(amount) as total from public.credit_transactions group by user_id) t on t.user_id = w.user_id
       where w.balance <> coalesce(t.total, 0)
       limit 500) x), '[]'::jsonb));
end;
$$;

-- -----------------------------------------------------------------------------
-- Supabase Cron : tâches planifiées et dernière exécution.
-- -----------------------------------------------------------------------------
create or replace function public.admin_cron_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then return private.forbidden(); end if;
  return jsonb_build_object('ok', true, 'jobs', coalesce((
    select jsonb_agg(x order by x.jobname) from (
      select j.jobname, j.schedule, j.active, d.status as last_status, d.start_time as last_start, d.end_time as last_end,
             left(d.return_message, 300) as last_message
        from cron.job j
        left join lateral (
          select r.status, r.start_time, r.end_time, r.return_message from cron.job_run_details r
           where r.jobid = j.jobid order by r.start_time desc limit 1) d on true) x), '[]'::jsonb));
end;
$$;

-- -----------------------------------------------------------------------------
-- Suivi de l'IA : tokens et coût par jour / mois, échecs, versions de prompt.
-- -----------------------------------------------------------------------------
create or replace function public.admin_ai_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then return private.forbidden(); end if;
  return jsonb_build_object(
    'ok', true,
    'by_day', coalesce((
      select jsonb_agg(x order by x.period desc) from (
        select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as period, count(*) as runs,
               count(*) filter (where status = 'failed') as failed,
               coalesce(sum(input_tokens), 0) as input_tokens, coalesce(sum(output_tokens), 0) as output_tokens,
               round(coalesce(sum(cost_estimate_usd), 0)::numeric, 4) as cost_usd
          from public.ai_generation_runs where created_at >= now() - interval '30 days'
         group by 1) x), '[]'::jsonb),
    'by_month', coalesce((
      select jsonb_agg(x order by x.period desc) from (
        select to_char(date_trunc('month', created_at), 'YYYY-MM') as period, count(*) as runs,
               count(*) filter (where status = 'failed') as failed,
               coalesce(sum(input_tokens), 0) as input_tokens, coalesce(sum(output_tokens), 0) as output_tokens,
               round(coalesce(sum(cost_estimate_usd), 0)::numeric, 4) as cost_usd
          from public.ai_generation_runs where created_at >= now() - interval '12 months'
         group by 1) x), '[]'::jsonb),
    'by_prompt', coalesce((
      select jsonb_agg(x order by x.prompt_version) from (
        select r.prompt_version, count(*) as runs, count(*) filter (where r.status = 'failed') as failed,
               (select count(*) from public.predictions p where p.prompt_version = r.prompt_version and p.result = 'won') as won,
               (select count(*) from public.predictions p where p.prompt_version = r.prompt_version and p.result = 'lost') as lost
          from public.ai_generation_runs r group by r.prompt_version) x), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Droits : authenticated uniquement (contrôle is_admin() dans chaque fonction).
-- -----------------------------------------------------------------------------
revoke all on function public.admin_log_action(text, text, text, jsonb, jsonb, text) from public, anon;
revoke all on function public.admin_overview() from public, anon;
revoke all on function public.admin_list_users(text, text, text, integer, integer) from public, anon;
revoke all on function public.admin_get_user(uuid) from public, anon;
revoke all on function public.admin_set_user_banned(uuid, boolean, text) from public, anon;
revoke all on function public.admin_set_user_role(uuid, public.user_role, text) from public, anon;
revoke all on function public.admin_edit_prediction_text(bigint, text, text) from public, anon;
revoke all on function public.admin_set_prediction_status(bigint, public.prediction_status, text) from public, anon;
revoke all on function public.admin_settle_fixture(bigint) from public, anon;
revoke all on function public.admin_refund_fixture(bigint, text) from public, anon;
revoke all on function public.admin_consistency_check() from public, anon;
revoke all on function public.admin_cron_status() from public, anon;
revoke all on function public.admin_ai_stats() from public, anon;

grant execute on function public.admin_log_action(text, text, text, jsonb, jsonb, text) to authenticated;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_list_users(text, text, text, integer, integer) to authenticated;
grant execute on function public.admin_get_user(uuid) to authenticated;
grant execute on function public.admin_set_user_banned(uuid, boolean, text) to authenticated;
grant execute on function public.admin_set_user_role(uuid, public.user_role, text) to authenticated;
grant execute on function public.admin_edit_prediction_text(bigint, text, text) to authenticated;
grant execute on function public.admin_set_prediction_status(bigint, public.prediction_status, text) to authenticated;
grant execute on function public.admin_settle_fixture(bigint) to authenticated;
grant execute on function public.admin_refund_fixture(bigint, text) to authenticated;
grant execute on function public.admin_consistency_check() to authenticated;
grant execute on function public.admin_cron_status() to authenticated;
grant execute on function public.admin_ai_stats() to authenticated;

-- Index : journal d'audit par date, transactions par type et date (filtres admin).
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index if not exists credit_transactions_type_created_idx on public.credit_transactions (type, created_at desc);
