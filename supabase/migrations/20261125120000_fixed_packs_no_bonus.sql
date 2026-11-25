-- =============================================================================
-- PRONEX — Packs fixes, suppression de tous les bonus de crédits (25/11/2026).
--
-- Grille officielle : STARTER 1 000 F = 10 · BASIC 2 500 F = 25 ·
-- PREMIUM 5 000 F = 50 (recommandé) · PRO 10 000 F = 110 · VIP 20 000 F = 250.
-- Chaque achat crédite EXACTEMENT les crédits du pack.
--
-- Migration NON destructive :
--   * aucune table ni colonne supprimée (bonus_credits, promo_bonus_credits,
--     promo_codes, promo_attempts et le type de transaction « bonus » restent,
--     pour l'historique) ; aucun solde ni transaction modifié ;
--   * les colonnes de bonus sont verrouillées à 0 pour l'avenir (contraintes) ;
--   * crédits de bienvenue, bonus de pack et codes promo ne sont plus jamais
--     attribués (handle_new_user, start_topup, apply_topup réécrites).
-- Il n'existe pas de bonus de premier achat ni de parrainage dans le code.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Packs : grille officielle, bonus à 0, pack mis en avant.
-- -----------------------------------------------------------------------------
alter table public.credit_packs
  add column if not exists is_featured boolean not null default false;

comment on column public.credit_packs.is_featured is
  'Pack mis en avant comme « recommandé » sur la page de recharge (aucun bonus associé).';

update public.credit_packs set credits = 10,  price_xof = 1000,  bonus_credits = 0, is_active = true, is_featured = false where lower(name) = 'starter';
update public.credit_packs set credits = 25,  price_xof = 2500,  bonus_credits = 0, is_active = true, is_featured = false where lower(name) = 'basic';
update public.credit_packs set credits = 50,  price_xof = 5000,  bonus_credits = 0, is_active = true, is_featured = true where lower(name) = 'premium';
update public.credit_packs set credits = 110, price_xof = 10000, bonus_credits = 0, is_active = true, is_featured = false where lower(name) = 'pro';
update public.credit_packs set credits = 250, price_xof = 20000, bonus_credits = 0, is_active = true, is_featured = false where lower(name) = 'vip';
-- Tout autre pack (créé à la main) perd aussi son bonus.
update public.credit_packs set bonus_credits = 0 where bonus_credits <> 0;

-- Grille officielle présente même sur une base où un pack manquerait (idempotent).
insert into public.credit_packs (name, credits, bonus_credits, price_xof, is_active, sort_order, is_featured)
select v.name, v.credits, 0, v.price_xof, true, v.sort_order, v.featured
  from (values ('Starter', 10, 1000, 1, false), ('Basic', 25, 2500, 2, false), ('Premium', 50, 5000, 3, true),
               ('Pro', 110, 10000, 4, false), ('VIP', 250, 20000, 5, false))
       as v(name, credits, price_xof, sort_order, featured)
 where not exists (select 1 from public.credit_packs cp where lower(cp.name) = lower(v.name));

alter table public.credit_packs
  add constraint credit_packs_no_bonus check (bonus_credits = 0);

-- Recharges FUTURES : aucun bonus possible (les lignes passées ne sont pas revérifiées).
alter table public.topups
  add constraint topups_no_bonus check (bonus_credits = 0 and promo_bonus_credits = 0) not valid;

-- -----------------------------------------------------------------------------
-- 2. Codes promo (ils ne servaient qu'à offrir des crédits) : tous désactivés.
-- -----------------------------------------------------------------------------
update public.promo_codes set is_active = false where is_active;

-- -----------------------------------------------------------------------------
-- 3. Crédits de bienvenue : désactivés (réglage conservé à 0 pour l'historique).
-- -----------------------------------------------------------------------------
update public.app_settings
   set value = '0'::jsonb,
       description = 'Désactivé : PRONEX n''offre aucun crédit gratuit (packs fixes).'
 where key = 'welcome_credits';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta             jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_display_name   text;
  v_country        text;
  v_phone          text;
  v_terms_at       timestamptz;
begin
  -- Nom d'affichage : métadonnée, sinon partie locale de l'e-mail, sinon « Utilisateur ».
  v_display_name := left(
    coalesce(
      nullif(btrim(meta ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Utilisateur'
    ),
    50
  );
  v_country := nullif(btrim(meta ->> 'country'), '');
  v_phone   := nullif(btrim(meta ->> 'phone'), '');

  -- RG-F1-1 : date d'acceptation des CGU + déclaration 18 ans.
  begin
    v_terms_at := nullif(meta ->> 'terms_accepted_at', '')::timestamptz;
  exception when others then
    v_terms_at := null;
  end;
  if v_terms_at is null and (meta ->> 'terms_accepted') = 'true' then
    v_terms_at := now();
  end if;

  insert into public.profiles (id, display_name, country, phone, terms_accepted_at)
  values (new.id, v_display_name, v_country, v_phone, v_terms_at);

  -- Portefeuille vide : aucun crédit de bienvenue (packs fixes, sans bonus).
  insert into public.wallets (user_id, balance)
  values (new.id, 0);

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Démarrage d'une recharge : prix et crédits lus en base, aucun bonus.
--    Même signature (compatibilité) ; un code promo envoyé est refusé.
-- -----------------------------------------------------------------------------
create or replace function public.start_topup(p_pack_id bigint, p_provider text, p_promo_code text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user      uuid := (select auth.uid());
  v_pack      record;
  v_pending   integer;
  v_methods   jsonb;
  v_id        uuid;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED', 'message', 'Connectez-vous pour recharger votre compte.');
  end if;
  if exists (select 1 from public.profiles p where p.id = v_user and p.is_banned) then
    return jsonb_build_object('ok', false, 'code', 'BANNED', 'message', 'Ce compte est suspendu.');
  end if;
  if (private.setting('maintenance_mode', 'false') #>> '{}')::boolean then
    return jsonb_build_object('ok', false, 'code', 'MAINTENANCE', 'message', 'Les recharges sont momentanément suspendues (maintenance).');
  end if;
  if nullif(btrim(coalesce(p_promo_code, '')), '') is not null then
    return jsonb_build_object('ok', false, 'code', 'PROMO_DISABLED', 'message', 'Les codes promo ne sont plus proposés.');
  end if;
  if p_provider is null or p_provider not in ('mock', 'fedapay', 'kkiapay') then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Fournisseur de paiement inconnu.');
  end if;
  v_methods := private.setting('payment_methods', '{}');
  if jsonb_typeof(v_methods -> p_provider) = 'object' and (v_methods -> p_provider ->> 'enabled') = 'false' then
    return jsonb_build_object('ok', false, 'code', 'PAYMENT_DISABLED', 'message', 'Ce moyen de paiement est désactivé.');
  end if;
  select cp.id, cp.name, cp.credits, cp.price_xof
    into v_pack
    from public.credit_packs cp
   where cp.id = p_pack_id and cp.is_active
     and (cp.available_from is null or cp.available_from <= now())
     and (cp.available_until is null or cp.available_until > now());
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_AVAILABLE', 'message', 'Ce pack n''est pas disponible.');
  end if;
  select count(*) into v_pending
    from public.topups t
   where t.user_id = v_user and t.status = 'pending' and t.created_at > now() - interval '1 hour';
  if v_pending >= 10 then
    return jsonb_build_object('ok', false, 'code', 'TOO_MANY_PENDING', 'message', 'Trop de recharges en attente. Réessayez plus tard.');
  end if;
  insert into public.topups (user_id, pack_id, credits, bonus_credits, amount_xof, provider, status, promo_code_id, promo_bonus_credits)
  values (v_user, v_pack.id, v_pack.credits, 0, v_pack.price_xof, p_provider, 'pending', null, 0)
  returning id into v_id;
  return jsonb_build_object(
    'ok', true,
    'topup_id', v_id,
    'pack_name', v_pack.name,
    'credits', v_pack.credits,
    'bonus_credits', 0,
    'promo_bonus_credits', 0,
    'amount_xof', v_pack.price_xof
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Application d'une recharge confirmée par le prestataire : crédite
--    EXACTEMENT topups.credits (jamais de bonus), une seule fois (statut
--    pending → final sous verrou ; un second appel renvoie already_processed).
-- -----------------------------------------------------------------------------
create or replace function public.apply_topup(p_topup_id uuid, p_status public.topup_status)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_topup   record;
  v_pack    text;
  v_balance integer;
  v_new     integer;
  v_tx_id   bigint;
begin
  if p_status is null or p_status = 'pending' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Statut final attendu : succeeded, failed ou cancelled.');
  end if;
  select t.* into v_topup from public.topups t where t.id = p_topup_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Recharge introuvable.');
  end if;
  if v_topup.status <> 'pending' then
    return jsonb_build_object('ok', true, 'already_processed', true, 'status', v_topup.status, 'topup_id', v_topup.id);
  end if;
  if p_status = 'succeeded' then
    select w.balance into v_balance from public.wallets w where w.user_id = v_topup.user_id for update;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Portefeuille introuvable.');
    end if;
    v_new := v_balance + v_topup.credits;
    select cp.name into v_pack from public.credit_packs cp where cp.id = v_topup.pack_id;
    update public.wallets set balance = v_new where user_id = v_topup.user_id;
    insert into public.credit_transactions (user_id, type, amount, balance_after, reference_type, reference_id, description)
    values (v_topup.user_id, 'topup', v_topup.credits, v_new, 'topup', v_topup.id::text,
            'Recharge' || coalesce(' : pack ' || v_pack, '') || ' (' || v_topup.credits || ' crédits)')
    returning id into v_tx_id;
    update public.topups set status = 'succeeded', completed_at = now() where id = v_topup.id;
    return jsonb_build_object('ok', true, 'already_processed', false, 'status', 'succeeded', 'topup_id', v_topup.id,
                              'credited', v_topup.credits, 'new_balance', v_new, 'transaction_id', v_tx_id);
  end if;
  update public.topups set status = p_status, completed_at = now() where id = v_topup.id;
  return jsonb_build_object('ok', true, 'already_processed', false, 'status', p_status, 'topup_id', v_topup.id, 'credited', 0);
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Indicateurs admin : plus d'indicateurs de bonus ; ventes par pack détaillées.
-- -----------------------------------------------------------------------------
create or replace function public.admin_revenue(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz    text := 'Africa/Porto-Novo';
  v_start timestamptz;
  v_end   timestamptz;
begin
  if not public.is_admin() then return private.forbidden(); end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 731 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Période invalide (2 ans au plus).');
  end if;
  v_start := p_from::timestamp at time zone v_tz;
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
$$;

-- admin_overview : « crédits vendus » = crédits des packs payés (sans bonus).
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
    'credits_sold', (select coalesce(sum(credits), 0) from public.topups where status = 'succeeded'),
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
