-- =============================================================================
-- Crédits v2, lot 5 — Historique (module 5) et suivi des générations (module 6).
--
-- 1. Un pronostic acheté (is_locked) ne peut plus être modifié rétroactivement,
--    quel que soit le rôle : sélection, probabilités, confiance, marché, version
--    du prompt sont figés ; il ne peut pas être supprimé ni « déverrouillé ».
--    Restent permis : le résultat (résolution), la visibilité (masquage admin)
--    et la correction d'une faute dans l'explication (admin_edit_prediction_text,
--    historisée dans prediction_revisions, RG-F5-6).
-- 2. get_my_predictions renvoie aussi la probabilité, la confiance, la version
--    du prompt, les crédits dépensés et le score à la mi-temps.
-- 3. admin_generation_requests : liste des générations à la demande.
-- =============================================================================

create or replace function public.protect_locked_prediction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    -- Seule exception : suppression du match entier (cascade ; le match parent
    -- est déjà supprimé quand ce déclencheur s'exécute).
    if old.is_locked and exists (select 1 from public.fixtures f where f.id = old.fixture_id) then
      raise exception 'Pronostic acheté : il ne peut pas être supprimé.' using errcode = '42501';
    end if;
    return old;
  end if;
  if old.is_locked and (
       not new.is_locked
    or new.fixture_id is distinct from old.fixture_id
    or new.market_code is distinct from old.market_code
    or new.selection is distinct from old.selection
    or new.selection_label is distinct from old.selection_label
    or new.probability is distinct from old.probability
    or new.probabilities is distinct from old.probabilities
    or new.confidence is distinct from old.confidence
    or new.version is distinct from old.version
    or new.prompt_version is distinct from old.prompt_version
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Pronostic acheté : son contenu est figé (seuls le résultat, la visibilité et la correction de l''explication sont permis).'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function public.protect_locked_prediction() is
  'Déclencheur : contenu d''un pronostic acheté figé (module 5, RG-F5-6), suppression interdite.';
revoke all on function public.protect_locked_prediction() from public, anon, authenticated;

create trigger predictions_protect_locked
  before update or delete on public.predictions
  for each row execute function public.protect_locked_prediction();

-- -----------------------------------------------------------------------------
-- Historique de l'utilisateur (même signature, champs ajoutés).
-- -----------------------------------------------------------------------------
create or replace function public.get_my_predictions(p_limit integer default 200)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select distinct on (p.id)
           p.id as prediction_id, p.fixture_id, p.market_code, p.selection_label, p.result,
           p.probability, p.confidence, p.prompt_version, p.settled_at,
           u.refunded_at is not null as refunded, u.created_at as unlocked_at,
           u.credits_spent, (u.market_code is null) as via_bundle
      from public.unlocks u
      join public.predictions p
        on p.fixture_id = u.fixture_id
       and (u.market_code = p.market_code or (u.market_code is null and p.status = 'published'))
     where u.user_id = (select auth.uid())
     order by p.id, (u.market_code is null), u.created_at
  )
  select coalesce(jsonb_agg(row_to_json(x) order by x.kickoff_at desc, x.fixture_id desc, x.market_order), '[]'::jsonb)
    from (
      select mi.prediction_id, mi.fixture_id, mi.market_code, m.label as market_label, m.sort_order as market_order,
             mi.selection_label, mi.result, mi.refunded, mi.unlocked_at,
             mi.probability, mi.confidence, mi.prompt_version, mi.settled_at, mi.credits_spent, mi.via_bundle,
             f.kickoff_at, f.status_short, f.ft_home, f.ft_away, f.goals_home, f.goals_away, f.ht_home, f.ht_away,
             h.name as home_name, a.name as away_name, c.name as competition_name
        from mine mi
        join public.fixtures f on f.id = mi.fixture_id
        join public.competitions c on c.id = f.competition_id
        join public.markets m on m.code = mi.market_code
        join public.teams h on h.id = f.home_team_id
        join public.teams a on a.id = f.away_team_id
       order by f.kickoff_at desc
       limit greatest(1, least(coalesce(p_limit, 200), 500))
    ) x;
$$;

-- -----------------------------------------------------------------------------
-- Admin : générations à la demande (les plus récentes d'abord).
-- -----------------------------------------------------------------------------
create or replace function public.admin_generation_requests(p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then return private.forbidden(); end if;
  return jsonb_build_object('ok', true, 'rows', coalesce((
    select jsonb_agg(x order by x.created_at desc) from (
      select r.id, r.created_at, r.status, r.price, r.market_code, left(r.error, 300) as error,
             r.started_at, r.completed_at, r.user_id, p.display_name, r.fixture_id,
             h.name || ' – ' || a.name as match
        from public.generation_requests r
        join public.profiles p on p.id = r.user_id
        join public.fixtures f on f.id = r.fixture_id
        join public.teams h on h.id = f.home_team_id
        join public.teams a on a.id = f.away_team_id
       order by r.created_at desc
       limit greatest(1, least(coalesce(p_limit, 100), 500))) x), '[]'::jsonb),
    'counts', (select jsonb_object_agg(status, n) from (
      select status, count(*) as n from public.generation_requests
       where created_at >= now() - interval '30 days' group by status) s));
end;
$$;

comment on function public.admin_generation_requests(integer) is
  'Admin : générations IA à la demande (utilisateur, match, type, prix, statut, erreur) et totaux sur 30 jours.';
revoke all on function public.admin_generation_requests(integer) from public, anon;
grant execute on function public.admin_generation_requests(integer) to authenticated;
