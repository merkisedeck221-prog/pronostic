-- =============================================================================
-- Phase 7 — Crédits et déblocage (sections 5-F4/F5/F6, 6, 10 et 11)
--
-- Fonctions :
--   get_unlock_price(fixture, market)       prix pour l'utilisateur connecté
--   unlock_prediction(fixture, market)      déblocage atomique (une transaction)
--   get_fixture_predictions(fixture)        marchés + contenu UNIQUEMENT si débloqué
--   admin_adjust_balance(user, amount, why) ajustement manuel (admin)
-- p_market_code vide ou NULL = « match complet ».
--
-- Sécurité :
--   * SECURITY DEFINER + search_path = '' ; auth.uid() uniquement (aucun
--     identifiant d'utilisateur en paramètre pour les fonctions utilisateur).
--   * Les helpers du schéma private ne sont pas exposés par l'API.
--   * Erreurs métier renvoyées en JSON { ok:false, code, message } :
--     NOT_AUTHENTICATED, BANNED, MAINTENANCE, NOT_AVAILABLE, MATCH_STARTED,
--     ALREADY_UNLOCKED, INSUFFICIENT_BALANCE (+ FORBIDDEN, INVALID_INPUT).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers internes (schéma private, non exposé)
-- -----------------------------------------------------------------------------

-- Valeur d'un paramètre app_settings (jsonb), avec valeur par défaut.
create or replace function private.setting(p_key text, p_default jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.value from public.app_settings s where s.key = p_key), p_default);
$$;

-- Prix d'un marché ou du match complet (p_market NULL) : règle propre à la
-- compétition, sinon règle générale ; NULL si aucune règle active (section 6).
create or replace function private.base_price(p_competition_id bigint, p_market text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select r.credits
    from public.pricing_rules r
   where r.is_active
     and r.scope = case when p_market is null then 'match_bundle' else 'market' end
     and r.market_code is not distinct from p_market
     and (r.competition_id = p_competition_id or r.competition_id is null)
   order by (r.competition_id is null) asc   -- règle de la compétition d'abord
   limit 1;
$$;

-- Accès d'un utilisateur à un marché (p_market) ou au match complet (NULL).
create or replace function private.has_access(p_user uuid, p_fixture_id bigint, p_market text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user is not null and exists (
    select 1 from public.unlocks u
     where u.user_id = p_user
       and u.fixture_id = p_fixture_id
       and (u.market_code is null or (p_market is not null and u.market_code = p_market))
  );
$$;

-- Prix pour un utilisateur (NULL = visiteur) : JSON
--   { ok:true, price, base_price, deduction } ou { ok:false, code, message }.
-- Match complet : base - déjà payé sur les marchés de ce match (RG-F5-3), ≥ 0.
create or replace function private.compute_price(p_user uuid, p_fixture_id bigint, p_market text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_competition bigint;
  v_mode        text := private.setting('pricing_mode', '"both"') #>> '{}';
  v_base        integer;
  v_paid        integer := 0;
begin
  select f.competition_id into v_competition from public.fixtures f where f.id = p_fixture_id;
  if v_competition is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_AVAILABLE', 'message', 'Match introuvable.');
  end if;

  if p_market is null and v_mode not in ('per_match', 'both') then
    return jsonb_build_object('ok', false, 'code', 'NOT_AVAILABLE', 'message', 'Le déblocage du match complet n''est pas proposé.');
  end if;
  if p_market is not null and v_mode not in ('per_market', 'both') then
    return jsonb_build_object('ok', false, 'code', 'NOT_AVAILABLE', 'message', 'Le déblocage par pronostic n''est pas proposé.');
  end if;

  v_base := private.base_price(v_competition, p_market);
  if v_base is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_AVAILABLE', 'message', 'Aucun prix n''est défini pour ce déblocage.');
  end if;

  if p_market is null and p_user is not null then
    select coalesce(sum(u.credits_spent), 0) into v_paid
      from public.unlocks u
     where u.user_id = p_user and u.fixture_id = p_fixture_id
       and u.market_code is not null and u.refunded_at is null;
  end if;

  return jsonb_build_object(
    'ok', true,
    'price', greatest(v_base - v_paid, 0),
    'base_price', v_base,
    'deduction', least(v_paid, v_base)
  );
end;
$$;

revoke all on function private.setting(text, jsonb) from public, anon, authenticated;
revoke all on function private.base_price(bigint, text) from public, anon, authenticated;
revoke all on function private.has_access(uuid, bigint, text) from public, anon, authenticated;
revoke all on function private.compute_price(uuid, bigint, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- get_unlock_price : prix pour l'utilisateur connecté (RG-F5-5 : calculé ici).
-- -----------------------------------------------------------------------------
create or replace function public.get_unlock_price(p_fixture_id bigint, p_market_code text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_market text := nullif(btrim(p_market_code), '');
begin
  if not public.is_fixture_visible(p_fixture_id) then
    return jsonb_build_object('ok', false, 'code', 'NOT_AVAILABLE', 'message', 'Match introuvable.');
  end if;
  if v_market is not null and not exists (select 1 from public.markets m where m.code = v_market and m.is_active) then
    return jsonb_build_object('ok', false, 'code', 'NOT_AVAILABLE', 'message', 'Ce type de pronostic n''est pas disponible.');
  end if;
  return private.compute_price((select auth.uid()), p_fixture_id, v_market);
end;
$$;

comment on function public.get_unlock_price(bigint, text) is
  'Prix (crédits) d''un marché ou du match complet (marché vide) pour l''utilisateur connecté, règles de la section 6.';

revoke all on function public.get_unlock_price(bigint, text) from public, anon;
grant execute on function public.get_unlock_price(bigint, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- unlock_prediction : déblocage atomique (RG-F5-1 à RG-F5-6).
-- -----------------------------------------------------------------------------
create or replace function public.unlock_prediction(p_fixture_id bigint, p_market_code text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user        uuid := (select auth.uid());
  v_market      text := nullif(btrim(p_market_code), '');
  v_fixture     record;
  v_price_json  jsonb;
  v_price       integer;
  v_balance     integer;
  v_new_balance integer;
  v_tx_id       bigint;
  v_label       text;
  v_market_lbl  text;
begin
  -- 1. Utilisateur connecté, non suspendu (RG-F1-2).
  if v_user is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED', 'message', 'Connectez-vous pour débloquer un pronostic.');
  end if;
  if exists (select 1 from public.profiles p where p.id = v_user and p.is_banned) then
    return jsonb_build_object('ok', false, 'code', 'BANNED', 'message', 'Ce compte est suspendu.');
  end if;

  -- 2. Mode maintenance.
  if (private.setting('maintenance_mode', 'false') #>> '{}')::boolean then
    return jsonb_build_object('ok', false, 'code', 'MAINTENANCE', 'message', 'Les déblocages sont momentanément suspendus (maintenance).');
  end if;

  -- 3. Match publié, compétition active.
  select f.id, f.kickoff_at, f.status_short, h.name as home_name, a.name as away_name
    into v_fixture
    from public.fixtures f
    join public.teams h on h.id = f.home_team_id
    join public.teams a on a.id = f.away_team_id
   where f.id = p_fixture_id;
  if not found or not public.is_fixture_visible(p_fixture_id) then
    return jsonb_build_object('ok', false, 'code', 'NOT_AVAILABLE', 'message', 'Ce match n''est pas disponible.');
  end if;

  -- 4. Match annulé / reporté : pas de vente. Coup d'envoi strictement futur (RG-F5-4).
  if v_fixture.status_short in ('PST', 'CANC', 'ABD', 'AWD', 'WO') then
    return jsonb_build_object('ok', false, 'code', 'NOT_AVAILABLE', 'message', 'Ce match est reporté ou annulé : les déblocages sont fermés.');
  end if;
  if v_fixture.kickoff_at <= now() or v_fixture.status_short not in ('NS', 'TBD') then
    return jsonb_build_object('ok', false, 'code', 'MATCH_STARTED', 'message', 'Le match a commencé : les déblocages sont fermés.');
  end if;

  -- 5. Marché actif avec un pronostic publié (match complet : au moins un).
  if v_market is not null then
    select m.label into v_market_lbl from public.markets m where m.code = v_market and m.is_active;
    if v_market_lbl is null or not exists (
      select 1 from public.predictions p
       where p.fixture_id = p_fixture_id and p.market_code = v_market and p.status = 'published'
    ) then
      return jsonb_build_object('ok', false, 'code', 'NOT_AVAILABLE', 'message', 'Ce pronostic n''est pas disponible.');
    end if;
  else
    v_market_lbl := 'match complet';
    if not exists (
      select 1 from public.predictions p join public.markets m on m.code = p.market_code and m.is_active
       where p.fixture_id = p_fixture_id and p.status = 'published'
    ) then
      return jsonb_build_object('ok', false, 'code', 'NOT_AVAILABLE', 'message', 'Aucun pronostic n''est disponible pour ce match.');
    end if;
  end if;

  -- 6. Verrou du portefeuille : sérialise les déblocages simultanés de cet utilisateur.
  select w.balance into v_balance from public.wallets w where w.user_id = v_user for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_AVAILABLE', 'message', 'Portefeuille introuvable.');
  end if;

  -- 7. Déjà débloqué ? (vérifié APRÈS le verrou ; un marché couvert par le match complet compte).
  if private.has_access(v_user, p_fixture_id, v_market) then
    return jsonb_build_object('ok', false, 'code', 'ALREADY_UNLOCKED', 'message', 'Vous avez déjà débloqué ce pronostic.');
  end if;

  -- 8. Prix calculé côté serveur (RG-F5-5), après le verrou.
  v_price_json := private.compute_price(v_user, p_fixture_id, v_market);
  if not (v_price_json ->> 'ok')::boolean then
    return v_price_json;
  end if;
  v_price := (v_price_json ->> 'price')::integer;

  -- 9. Solde suffisant (RG-F5-2).
  if v_balance < v_price then
    return jsonb_build_object(
      'ok', false, 'code', 'INSUFFICIENT_BALANCE', 'message', 'Solde insuffisant : rechargez votre compte.',
      'price', v_price, 'balance', v_balance
    );
  end if;

  -- 10. Débit + transaction (un déblocage gratuit, ex. match complet entièrement déduit, n'en crée pas).
  v_new_balance := v_balance - v_price;
  if v_price > 0 then
    update public.wallets set balance = v_new_balance where user_id = v_user;
    v_label := 'Déblocage : ' || v_fixture.home_name || ' – ' || v_fixture.away_name || ', ' || v_market_lbl;
    insert into public.credit_transactions (user_id, type, amount, balance_after, reference_type, reference_id, description, created_by)
    values (v_user, 'unlock', -v_price, v_new_balance, 'fixture', p_fixture_id::text, v_label, v_user)
    returning id into v_tx_id;
  end if;

  -- 11. Accès (contrainte d'unicité = dernière barrière contre les doublons, RG-F5-3).
  begin
    insert into public.unlocks (user_id, fixture_id, market_code, credits_spent, transaction_id)
    values (v_user, p_fixture_id, v_market, v_price, v_tx_id);
  exception when unique_violation then
    raise exception 'ALREADY_UNLOCKED' using errcode = 'P0001'; -- annule le débit (transaction)
  end;

  -- 12. Pronostics figés dès le premier achat (RG-F5-6).
  update public.predictions p
     set is_locked = true
   where p.fixture_id = p_fixture_id
     and not p.is_locked
     and (v_market is null or p.market_code = v_market);

  return jsonb_build_object('ok', true, 'new_balance', v_new_balance, 'credits_spent', v_price, 'market_code', v_market);
end;
$$;

comment on function public.unlock_prediction(bigint, text) is
  'Déblocage atomique d''un marché ou du match complet (marché vide) pour l''utilisateur connecté.';

revoke all on function public.unlock_prediction(bigint, text) from public, anon;
grant execute on function public.unlock_prediction(bigint, text) to authenticated;

-- -----------------------------------------------------------------------------
-- get_fixture_predictions : marchés d'un match ; contenu UNIQUEMENT si débloqué
-- ou si le match est terminé et reveal_after_match = true (RG-F4-2, RG-F4-4).
-- Fonctionne pour un visiteur anonyme (aucun contenu verrouillé).
-- -----------------------------------------------------------------------------
create or replace function public.get_fixture_predictions(p_fixture_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user        uuid := (select auth.uid());
  v_fixture     record;
  v_finished    boolean;
  v_reveal      boolean;
  v_open        boolean;
  v_bundle      boolean;
  v_bundle_json jsonb;
  v_price       jsonb;
  v_markets     jsonb := '[]'::jsonb;
  v_row         record;
  v_access      boolean;
  v_show        boolean;
  v_item        jsonb;
  v_analysis    jsonb := null;
  v_mode        text := private.setting('pricing_mode', '"both"') #>> '{}';
begin
  if not public.is_fixture_visible(p_fixture_id) then
    return null;
  end if;
  select f.kickoff_at, f.status_short into v_fixture from public.fixtures f where f.id = p_fixture_id;

  v_finished := v_fixture.status_short in ('FT', 'AET', 'PEN');
  v_reveal   := v_finished and coalesce((private.setting('reveal_after_match', 'true') #>> '{}')::boolean, true);
  v_open     := v_fixture.kickoff_at > now()
                and v_fixture.status_short in ('NS', 'TBD')
                and not coalesce((private.setting('maintenance_mode', 'false') #>> '{}')::boolean, false);
  v_bundle   := private.has_access(v_user, p_fixture_id, null);

  for v_row in
    select p.market_code, m.label, m.sort_order, p.status, m.is_active,
           p.selection, p.selection_label, p.probability, p.probabilities, p.confidence, p.reasoning, p.result
      from public.predictions p
      join public.markets m on m.code = p.market_code
     where p.fixture_id = p_fixture_id
     order by m.sort_order, p.market_code
  loop
    v_access := private.has_access(v_user, p_fixture_id, v_row.market_code);
    -- Visible : marché actif et pronostic publié (RG-F4-3), ou déjà acheté (l'acheteur le conserve).
    continue when not ((v_row.is_active and v_row.status = 'published') or v_access);

    v_show := v_access or (v_reveal and v_row.status = 'published');
    v_price := private.compute_price(v_user, p_fixture_id, v_row.market_code);

    v_item := jsonb_build_object(
      'code', v_row.market_code,
      'label', v_row.label,
      'unlocked', v_access,
      'price', case when (v_price ->> 'ok')::boolean then (v_price ->> 'price')::integer end,
      'purchasable', v_open and not v_access and (v_price ->> 'ok')::boolean,
      'revealed', v_show
    );
    if v_show then
      v_item := v_item || jsonb_build_object(
        'selection', v_row.selection,
        'selection_label', v_row.selection_label,
        'probability', v_row.probability,
        'probabilities', v_row.probabilities,
        'confidence', v_row.confidence,
        'reasoning', v_row.reasoning,
        'result', v_row.result
      );
    end if;
    v_markets := v_markets || jsonb_build_array(v_item);
  end loop;

  -- Match complet : prix effectif (déduction RG-F5-3) et disponibilité.
  v_price := private.compute_price(v_user, p_fixture_id, null);
  v_bundle_json := jsonb_build_object(
    'unlocked', v_bundle,
    'offered', v_mode in ('per_match', 'both'),
    'price', case when (v_price ->> 'ok')::boolean then (v_price ->> 'price')::integer end,
    'base_price', case when (v_price ->> 'ok')::boolean then (v_price ->> 'base_price')::integer end,
    'purchasable', v_open and not v_bundle and (v_price ->> 'ok')::boolean and jsonb_array_length(v_markets) > 0
  );

  -- Analyse globale : match complet débloqué, ou match terminé (reveal_after_match).
  if v_bundle or v_reveal then
    select jsonb_build_object('summary', a.summary, 'key_factors', a.key_factors)
      into v_analysis
      from public.prediction_analyses a where a.fixture_id = p_fixture_id;
  end if;

  return jsonb_build_object(
    'fixture_id', p_fixture_id,
    'is_finished', v_finished,
    'unlocks_open', v_open,
    'pricing_mode', v_mode,
    'match_bundle', v_bundle_json,
    'markets', v_markets,
    'analysis', v_analysis
  );
end;
$$;

comment on function public.get_fixture_predictions(bigint) is
  'Pronostics d''un match : nom, prix et cadenas ; contenu seulement si débloqué ou match terminé (reveal_after_match).';

revoke all on function public.get_fixture_predictions(bigint) from public;
grant execute on function public.get_fixture_predictions(bigint) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- admin_adjust_balance : ajustement manuel (RG-F9-1, RG-F9-2).
-- Réservé aux admins (is_admin()) ou au serveur (service_role).
-- -----------------------------------------------------------------------------
create or replace function public.admin_adjust_balance(p_user_id uuid, p_amount integer, p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_admin   uuid := (select auth.uid());
  v_service boolean := coalesce((select auth.jwt() ->> 'role'), '') = 'service_role';
  v_reason  text := btrim(coalesce(p_reason, ''));
  v_balance integer;
  v_new     integer;
  v_tx_id   bigint;
begin
  if not (public.is_admin() or v_service) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Action réservée aux administrateurs.');
  end if;
  if char_length(v_reason) < 3 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Un motif est obligatoire.');
  end if;
  if p_amount is null or p_amount = 0 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT', 'message', 'Le montant doit être différent de 0.');
  end if;

  select w.balance into v_balance from public.wallets w where w.user_id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_AVAILABLE', 'message', 'Portefeuille introuvable.');
  end if;

  v_new := v_balance + p_amount;
  if v_new < 0 then
    return jsonb_build_object('ok', false, 'code', 'INSUFFICIENT_BALANCE',
      'message', 'L''ajustement rendrait le solde négatif.', 'balance', v_balance);
  end if;

  update public.wallets set balance = v_new where user_id = p_user_id;
  insert into public.credit_transactions (user_id, type, amount, balance_after, reference_type, description, created_by)
  values (p_user_id, 'admin_adjustment', p_amount, v_new, 'admin', 'Ajustement : ' || left(v_reason, 200), v_admin)
  returning id into v_tx_id;

  insert into public.admin_audit_log (admin_id, action, entity, entity_id, before, after, reason)
  values (v_admin, 'adjust_balance', 'wallets', p_user_id::text,
          jsonb_build_object('balance', v_balance),
          jsonb_build_object('balance', v_new, 'amount', p_amount, 'transaction_id', v_tx_id),
          left(v_reason, 500));

  return jsonb_build_object('ok', true, 'new_balance', v_new, 'transaction_id', v_tx_id);
end;
$$;

comment on function public.admin_adjust_balance(uuid, integer, text) is
  'Ajustement manuel du solde (admin ou serveur), motif obligatoire, jamais négatif, journalisé.';

revoke all on function public.admin_adjust_balance(uuid, integer, text) from public, anon;
grant execute on function public.admin_adjust_balance(uuid, integer, text) to authenticated, service_role;

-- Index : recherche des déblocages d'un utilisateur sur un match.
create index if not exists unlocks_user_fixture_idx on public.unlocks (user_id, fixture_id);
