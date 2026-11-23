-- =============================================================================
-- Crédits v2, lot 3 — Génération à la demande, mutualisée, avec réservation
-- des crédits (module 3). Décision D1 : le premier utilisateur qui paie
-- déclenche l'IA ; le résultat est unique par match et revendu aux suivants.
--
-- Parcours : request_generation (utilisateur) réserve les crédits
--   → start_generation (serveur) → moteur IA → complete_generation (accès
--   donné, réservation définitive) OU fail_generation (réservation libérée).
-- La réservation est une écriture de débit dans le journal immuable
-- (référence « generation_hold ») ; sa libération est un remboursement
-- (référence « generation_release »). Le solde ne peut donc jamais être
-- dépensé deux fois pendant la génération.
-- =============================================================================

create table public.generation_requests (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles (id) on delete cascade,
  fixture_id           bigint not null references public.fixtures (id) on delete restrict,
  -- NULL = analyse complète du match.
  market_code          text references public.markets (code) on delete restrict,
  idempotency_key      uuid not null,
  price                integer not null check (price >= 0),
  hold_transaction_id  bigint references public.credit_transactions (id) on delete set null,
  status               text not null default 'reserved'
                         check (status in ('reserved', 'running', 'succeeded', 'failed')),
  error                text check (error is null or char_length(error) <= 1000),
  started_at           timestamptz,
  completed_at         timestamptz,
  expires_at           timestamptz not null default now() + interval '10 minutes',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint generation_requests_idempotency unique (user_id, idempotency_key)
);

comment on table public.generation_requests is
  'Demandes de génération IA à la demande (réservation de crédits). Écriture par fonctions SQL uniquement.';

-- Une seule demande active par utilisateur, match et type d'analyse.
create unique index generation_requests_one_active_idx
  on public.generation_requests (user_id, fixture_id, coalesce(market_code, '*'))
  where status in ('reserved', 'running');
create index generation_requests_fixture_idx on public.generation_requests (fixture_id, status);
create index generation_requests_user_created_idx on public.generation_requests (user_id, created_at desc);
create index generation_requests_active_expiry_idx on public.generation_requests (expires_at) where status in ('reserved', 'running');
create index generation_requests_market_idx on public.generation_requests (market_code);
create index generation_requests_hold_tx_idx on public.generation_requests (hold_transaction_id);

create trigger generation_requests_set_updated_at
  before update on public.generation_requests
  for each row execute function public.set_updated_at();

alter table public.generation_requests enable row level security;

create policy generation_requests_select_own_or_admin on public.generation_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

revoke insert, update, delete, truncate on public.generation_requests from anon, authenticated;

insert into public.app_settings (key, value, description, is_public) values
  ('on_demand_generation_enabled', 'true'::jsonb, 'Génération IA à la demande (réservation de crédits) proposée aux utilisateurs.', true),
  ('on_demand_window_hours', '168'::jsonb, 'Délai maximal (heures) avant le coup d''envoi pour demander une analyse IA.', true)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Libération d'une réservation (interne) : remboursement + statut « failed ».
-- -----------------------------------------------------------------------------
create or replace function private.release_generation(p_request_id uuid, p_error text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_req     record;
  v_balance integer;
begin
  select * into v_req from public.generation_requests where id = p_request_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if v_req.status in ('succeeded', 'failed') then
    return jsonb_build_object('ok', true, 'already_processed', true, 'status', v_req.status);
  end if;
  if v_req.price > 0 and v_req.hold_transaction_id is not null then
    select w.balance into v_balance from public.wallets w where w.user_id = v_req.user_id for update;
    update public.wallets set balance = v_balance + v_req.price where user_id = v_req.user_id;
    insert into public.credit_transactions (user_id, type, amount, balance_after, reference_type, reference_id, description)
    values (v_req.user_id, 'refund', v_req.price, v_balance + v_req.price, 'generation_release', v_req.id::text,
            'Réservation libérée : l''analyse IA n''a pas pu être produite');
  end if;
  update public.generation_requests
     set status = 'failed', error = left(coalesce(p_error, 'Échec'), 1000), completed_at = now()
   where id = v_req.id;
  return jsonb_build_object('ok', true, 'status', 'failed', 'released', v_req.price);
end;
$$;

revoke all on function private.release_generation(uuid, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- request_generation (utilisateur) : vérifie le solde, calcule le prix EN BASE,
-- réserve les crédits. Idempotente (clé fournie par le navigateur) ; aucune
-- donnée de prix ni d'utilisateur acceptée en paramètre.
-- -----------------------------------------------------------------------------
create or replace function public.request_generation(p_fixture_id bigint, p_market_code text, p_idempotency_key uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user      uuid := (select auth.uid());
  v_market    text := nullif(btrim(p_market_code), '');
  v_fixture   record;
  v_req       record;
  v_label     text;
  v_window    integer := coalesce((private.setting('on_demand_window_hours', '168') #>> '{}')::integer, 168);
  v_price_j   jsonb;
  v_price     integer;
  v_balance   integer;
  v_tx_id     bigint;
  v_id        uuid := gen_random_uuid();
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED', 'message', 'Connectez-vous pour demander une analyse.');
  end if;
  if p_idempotency_key is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Requête invalide.');
  end if;
  if exists (select 1 from public.profiles p where p.id = v_user and p.is_banned) then
    return jsonb_build_object('ok', false, 'code', 'BANNED', 'message', 'Ce compte est suspendu.');
  end if;
  if (private.setting('maintenance_mode', 'false') #>> '{}')::boolean then
    return jsonb_build_object('ok', false, 'code', 'MAINTENANCE', 'message', 'Les analyses sont momentanément suspendues (maintenance).');
  end if;
  if not coalesce((private.setting('on_demand_generation_enabled', 'true') #>> '{}')::boolean, true) then
    return jsonb_build_object('ok', false, 'code', 'NOT_AVAILABLE', 'message', 'Les analyses à la demande sont désactivées.');
  end if;

  -- Rejeu de la même demande (double clic, réseau) : on renvoie la demande existante.
  select * into v_req from public.generation_requests r where r.user_id = v_user and r.idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('ok', true, 'request_id', v_req.id, 'status', v_req.status, 'price', v_req.price, 'replayed', true);
  end if;

  select f.id, f.kickoff_at, f.status_short, h.name as home_name, a.name as away_name into v_fixture
    from public.fixtures f
    join public.teams h on h.id = f.home_team_id
    join public.teams a on a.id = f.away_team_id
   where f.id = p_fixture_id;
  if not found or not public.is_fixture_visible(p_fixture_id) then
    return jsonb_build_object('ok', false, 'code', 'NOT_AVAILABLE', 'message', 'Ce match n''est pas disponible.');
  end if;
  if v_fixture.kickoff_at <= now() or v_fixture.status_short not in ('NS', 'TBD') then
    return jsonb_build_object('ok', false, 'code', 'MATCH_STARTED', 'message', 'Le match a commencé ou n''est plus programmé.');
  end if;
  if v_fixture.kickoff_at > now() + make_interval(hours => v_window) then
    return jsonb_build_object('ok', false, 'code', 'TOO_EARLY',
      'message', 'L''analyse sera possible ' || v_window || ' h avant le coup d''envoi.');
  end if;
  if v_market is not null then
    select m.label into v_label from public.markets m where m.code = v_market and m.is_active;
    if v_label is null then
      return jsonb_build_object('ok', false, 'code', 'NOT_AVAILABLE', 'message', 'Ce type d''analyse n''est pas disponible.');
    end if;
  else
    v_label := 'analyse complète';
  end if;

  -- Verrou du portefeuille : sérialise les demandes et déblocages du même utilisateur.
  select w.balance into v_balance from public.wallets w where w.user_id = v_user for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_AVAILABLE', 'message', 'Portefeuille introuvable.');
  end if;
  if private.has_access(v_user, p_fixture_id, v_market) then
    return jsonb_build_object('ok', false, 'code', 'ALREADY_UNLOCKED', 'message', 'Vous avez déjà accès à cette analyse.');
  end if;
  -- Résultat déjà produit (mutualisé) : achat immédiat par unlock_prediction.
  if exists (select 1 from public.predictions p join public.markets m on m.code = p.market_code and m.is_active
              where p.fixture_id = p_fixture_id and p.status = 'published'
                and (v_market is null or p.market_code = v_market)) then
    return jsonb_build_object('ok', false, 'code', 'ALREADY_AVAILABLE', 'message', 'L''analyse est déjà disponible : débloquez-la directement.');
  end if;
  select * into v_req from public.generation_requests r
   where r.user_id = v_user and r.fixture_id = p_fixture_id
     and coalesce(r.market_code, '*') = coalesce(v_market, '*') and r.status in ('reserved', 'running');
  if found then
    return jsonb_build_object('ok', true, 'request_id', v_req.id, 'status', v_req.status, 'price', v_req.price, 'replayed', true);
  end if;
  if (select count(*) from public.generation_requests r where r.user_id = v_user and r.created_at > now() - interval '10 minutes') >= 5 then
    return jsonb_build_object('ok', false, 'code', 'RATE_LIMIT', 'message', 'Trop de demandes. Réessayez dans quelques minutes.');
  end if;

  v_price_j := private.compute_price(v_user, p_fixture_id, v_market);
  if not (v_price_j ->> 'ok')::boolean then
    return v_price_j;
  end if;
  v_price := (v_price_j ->> 'price')::integer;
  if v_balance < v_price then
    return jsonb_build_object('ok', false, 'code', 'INSUFFICIENT_BALANCE', 'message', 'Solde insuffisant : rechargez votre compte.',
                              'price', v_price, 'balance', v_balance);
  end if;

  if v_price > 0 then
    update public.wallets set balance = v_balance - v_price where user_id = v_user;
    insert into public.credit_transactions (user_id, type, amount, balance_after, reference_type, reference_id, description, created_by)
    values (v_user, 'unlock', -v_price, v_balance - v_price, 'generation_hold', v_id::text,
            'Analyse IA : ' || v_fixture.home_name || ' – ' || v_fixture.away_name || ', ' || v_label, v_user)
    returning id into v_tx_id;
  end if;

  insert into public.generation_requests (id, user_id, fixture_id, market_code, idempotency_key, price, hold_transaction_id)
  values (v_id, v_user, p_fixture_id, v_market, p_idempotency_key, v_price, v_tx_id);

  return jsonb_build_object('ok', true, 'request_id', v_id, 'status', 'reserved', 'price', v_price,
                            'new_balance', v_balance - v_price, 'replayed', false);
end;
$$;

comment on function public.request_generation(bigint, text, uuid) is
  'Utilisateur : réserve le prix (calculé en base) d''une analyse IA à la demande. Idempotente. Une demande active par match et type.';
revoke all on function public.request_generation(bigint, text, uuid) from public, anon;
grant execute on function public.request_generation(bigint, text, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- start_generation (serveur) : passe la demande en « running ». Si une autre
-- demande du même match tourne déjà, répond « wait » (mutualisation : une
-- seule génération par match).
-- -----------------------------------------------------------------------------
create or replace function public.start_generation(p_request_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_req record;
begin
  select * into v_req from public.generation_requests where id = p_request_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if v_req.status <> 'reserved' then
    return jsonb_build_object('ok', true, 'action', 'none', 'status', v_req.status, 'fixture_id', v_req.fixture_id);
  end if;
  if v_req.expires_at <= now() then
    return private.release_generation(v_req.id, 'Délai dépassé') || jsonb_build_object('action', 'none');
  end if;
  -- Verrou du match : une seule génération à la fois.
  perform 1 from public.fixtures where id = v_req.fixture_id for update;
  if exists (select 1 from public.generation_requests r
              where r.fixture_id = v_req.fixture_id and r.status = 'running' and r.id <> v_req.id
                and r.started_at > now() - interval '5 minutes') then
    return jsonb_build_object('ok', true, 'action', 'wait', 'status', 'reserved', 'fixture_id', v_req.fixture_id);
  end if;
  update public.generation_requests set status = 'running', started_at = now() where id = v_req.id;
  return jsonb_build_object('ok', true, 'action', 'generate', 'status', 'running', 'fixture_id', v_req.fixture_id);
end;
$$;

revoke all on function public.start_generation(uuid) from public, anon, authenticated;
grant execute on function public.start_generation(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- complete_generation (serveur) : si le résultat existe, l'accès est donné et
-- la réservation devient définitive ; sinon, elle est libérée. Idempotente.
-- -----------------------------------------------------------------------------
create or replace function public.complete_generation(p_request_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_req      record;
  v_balance  integer;
begin
  select * into v_req from public.generation_requests where id = p_request_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if v_req.status in ('succeeded', 'failed') then
    return jsonb_build_object('ok', true, 'already_processed', true, 'status', v_req.status);
  end if;
  if not exists (select 1 from public.predictions p join public.markets m on m.code = p.market_code and m.is_active
                  where p.fixture_id = v_req.fixture_id and p.status = 'published'
                    and (v_req.market_code is null or p.market_code = v_req.market_code)) then
    return private.release_generation(v_req.id, 'Aucun pronostic produit pour ce type d''analyse');
  end if;

  if private.has_access(v_req.user_id, v_req.fixture_id, v_req.market_code) then
    -- Accès déjà acquis entre-temps : la réservation est rendue, pas de double paiement.
    if v_req.price > 0 and v_req.hold_transaction_id is not null then
      select w.balance into v_balance from public.wallets w where w.user_id = v_req.user_id for update;
      update public.wallets set balance = v_balance + v_req.price where user_id = v_req.user_id;
      insert into public.credit_transactions (user_id, type, amount, balance_after, reference_type, reference_id, description)
      values (v_req.user_id, 'refund', v_req.price, v_balance + v_req.price, 'generation_release', v_req.id::text,
              'Réservation rendue : vous aviez déjà accès à cette analyse');
    end if;
  else
    insert into public.unlocks (user_id, fixture_id, market_code, credits_spent, transaction_id)
    values (v_req.user_id, v_req.fixture_id, v_req.market_code, v_req.price, v_req.hold_transaction_id);
    update public.predictions p set is_locked = true
     where p.fixture_id = v_req.fixture_id and not p.is_locked
       and (v_req.market_code is null or p.market_code = v_req.market_code);
  end if;

  update public.generation_requests set status = 'succeeded', completed_at = now(), error = null where id = v_req.id;
  perform private.notify(v_req.user_id, 'generation_ready', 'Analyse IA prête',
    'Votre analyse est disponible sur la fiche du match.', '/matchs/' || v_req.fixture_id, 'generation:' || v_req.id);
  return jsonb_build_object('ok', true, 'status', 'succeeded', 'fixture_id', v_req.fixture_id);
end;
$$;

revoke all on function public.complete_generation(uuid) from public, anon, authenticated;
grant execute on function public.complete_generation(uuid) to service_role;

create or replace function public.fail_generation(p_request_id uuid, p_error text)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select private.release_generation(p_request_id, p_error);
$$;

revoke all on function public.fail_generation(uuid, text) from public, anon, authenticated;
grant execute on function public.fail_generation(uuid, text) to service_role;

-- -----------------------------------------------------------------------------
-- Filet de sécurité (Cron, toutes les 5 min) : une demande bloquée au-delà de
-- son délai est terminée (accès si le résultat existe, sinon crédits rendus).
-- -----------------------------------------------------------------------------
create or replace function public.expire_generation_requests()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_count integer := 0;
begin
  for v_id in
    select r.id from public.generation_requests r
     where r.status in ('reserved', 'running') and r.expires_at <= now()
     order by r.expires_at
     limit 200
  loop
    perform public.complete_generation(v_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.expire_generation_requests() from public, anon, authenticated;
grant execute on function public.expire_generation_requests() to service_role;

select cron.schedule('expire-generation-requests', '*/5 * * * *', $$select public.expire_generation_requests()$$);
