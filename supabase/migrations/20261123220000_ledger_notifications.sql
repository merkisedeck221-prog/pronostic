-- =============================================================================
-- Crédits v2, lot 1 — Journal comptable immuable, notifications, résumé du
-- portefeuille. Plan : docs/PLAN-credits-v2.md (modules 1 et 7).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Journal comptable immuable (module 7).
-- Aucune ligne de credit_transactions ne peut être modifiée ni supprimée, quel
-- que soit le rôle (y compris la clé serveur). Une erreur se corrige par une
-- écriture inverse (ajustement, remboursement).
-- Seule exception : la suppression d'un compte (cascade auth.users → profiles →
-- credit_transactions). Dans une cascade, le profil parent est déjà supprimé
-- au moment où le déclencheur s'exécute : on autorise alors la suppression.
-- SECURITY DEFINER : la cascade est exécutée par le rôle d'Auth, qui ne lit
-- pas forcément public.profiles.
-- -----------------------------------------------------------------------------
create or replace function public.protect_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'Journal comptable immuable : une transaction ne peut pas être modifiée (passer par une écriture inverse).'
      using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles p where p.id = old.user_id) then
    raise exception 'Journal comptable immuable : une transaction ne peut pas être supprimée.'
      using errcode = '42501';
  end if;
  return old;
end;
$$;

comment on function public.protect_ledger() is
  'Déclencheur : interdit UPDATE et DELETE sur credit_transactions, sauf suppression du compte (cascade).';
revoke all on function public.protect_ledger() from public, anon, authenticated;

create trigger credit_transactions_immutable
  before update or delete on public.credit_transactions
  for each row execute function public.protect_ledger();

-- TRUNCATE ne déclenche pas les déclencheurs de ligne : on le retire à tous.
revoke update, delete, truncate on public.credit_transactions from anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. Notifications dans l'application (module 1).
-- Écrites uniquement par des déclencheurs (SECURITY DEFINER). L'utilisateur
-- lit les siennes (RLS) et les marque comme lues par une fonction dédiée.
-- -----------------------------------------------------------------------------
create table public.notifications (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind ~ '^[a-z_]{2,40}$'),
  title       text not null check (char_length(title) between 1 and 120),
  body        text not null check (char_length(body) between 1 and 500),
  -- Lien interne uniquement (jamais d'URL externe).
  link        text check (link is null or link ~ '^/[A-Za-z0-9/_?=&%.-]{0,200}$'),
  -- Évite les doublons (ex. une seule notification « résultat » par match).
  dedupe_key  text check (dedupe_key is null or char_length(dedupe_key) <= 120),
  read_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint notifications_dedupe_unique unique (user_id, dedupe_key)
);

comment on table public.notifications is 'Notifications in-app. Écriture serveur uniquement (déclencheurs).';

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;

create trigger notifications_set_updated_at
  before update on public.notifications
  for each row execute function public.set_updated_at();

alter table public.notifications enable row level security;

create policy notifications_select_own_or_admin on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

revoke insert, update, delete, truncate on public.notifications from anon, authenticated;

-- Écriture interne : ne fait jamais échouer l'opération financière qui l'appelle.
create or replace function private.notify(
  p_user uuid, p_kind text, p_title text, p_body text, p_link text, p_dedupe text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
  values (p_user, p_kind, left(p_title, 120), left(p_body, 500), p_link, p_dedupe)
  on conflict (user_id, dedupe_key) do nothing;
exception when others then
  raise warning 'notify(%, %) : %', p_user, p_kind, sqlerrm;
end;
$$;

revoke all on function private.notify(uuid, text, text, text, text, text) from public, anon, authenticated;

-- Mouvements de crédits : recharge, remboursement, ajustement, bonus.
create or replace function public.notify_credit_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_abs text := abs(new.amount)::text;
begin
  if new.type = 'topup' then
    perform private.notify(new.user_id, 'topup_succeeded', 'Recharge réussie',
      '+' || v_abs || ' crédits ajoutés. Nouveau solde : ' || new.balance_after || ' crédits.',
      '/portefeuille', 'tx:' || new.id);
  elsif new.type = 'refund' then
    perform private.notify(new.user_id, 'refund', 'Crédits remboursés',
      '+' || v_abs || ' crédits. ' || new.description, '/portefeuille?filtre=remboursements', 'tx:' || new.id);
  elsif new.type = 'admin_adjustment' then
    perform private.notify(new.user_id, 'admin_adjustment', 'Ajustement de votre solde',
      case when new.amount > 0 then '+' else '−' end || v_abs || ' crédits. Nouveau solde : ' || new.balance_after || ' crédits.',
      '/portefeuille', 'tx:' || new.id);
  elsif new.type = 'bonus' then
    perform private.notify(new.user_id, 'bonus', 'Crédits offerts',
      '+' || v_abs || ' crédits. ' || new.description, '/portefeuille', 'tx:' || new.id);
  end if;
  return null;
end;
$$;

revoke all on function public.notify_credit_transaction() from public, anon, authenticated;

create trigger credit_transactions_notify
  after insert on public.credit_transactions
  for each row execute function public.notify_credit_transaction();

-- Paiement échoué ou annulé.
create or replace function public.notify_topup_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'pending' and new.status in ('failed', 'cancelled') then
    perform private.notify(new.user_id, 'topup_failed',
      case when new.status = 'failed' then 'Paiement échoué' else 'Paiement annulé' end,
      'Votre recharge de ' || new.amount_xof || ' FCFA n''a pas abouti. Aucun crédit n''a été ajouté ni débité.',
      '/recharger', 'topup:' || new.id);
  end if;
  return null;
end;
$$;

revoke all on function public.notify_topup_status() from public, anon, authenticated;

create trigger topups_notify_status
  after update of status on public.topups
  for each row execute function public.notify_topup_status();

-- Pronostic résolu : une seule notification par utilisateur et par match.
create or replace function public.notify_prediction_settled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match text;
  v_user  uuid;
begin
  if old.result <> 'pending' or new.result not in ('won', 'lost') then
    return null;
  end if;
  select h.name || ' – ' || a.name into v_match
    from public.fixtures f
    join public.teams h on h.id = f.home_team_id
    join public.teams a on a.id = f.away_team_id
   where f.id = new.fixture_id;
  for v_user in
    select distinct u.user_id from public.unlocks u
     where u.fixture_id = new.fixture_id and u.refunded_at is null
       and (u.market_code is null or u.market_code = new.market_code)
  loop
    perform private.notify(v_user, 'prediction_settled', 'Résultat disponible',
      'Le match ' || coalesce(v_match, '') || ' est terminé : consultez le résultat de vos pronostics.',
      '/mes-pronostics', 'settled:' || new.fixture_id);
  end loop;
  return null;
end;
$$;

revoke all on function public.notify_prediction_settled() from public, anon, authenticated;

create trigger predictions_notify_settled
  after update of result on public.predictions
  for each row execute function public.notify_prediction_settled();

-- Marquer comme lues (toutes, ou une liste d'au plus 200). Jamais d'identifiant
-- d'utilisateur en paramètre : auth.uid() uniquement (règle 5).
create or replace function public.mark_notifications_read(p_ids bigint[] default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_count integer;
begin
  if v_user is null then
    return 0;
  end if;
  update public.notifications n
     set read_at = now()
   where n.user_id = v_user
     and n.read_at is null
     and (p_ids is null or n.id = any (p_ids[1:200]));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.mark_notifications_read(bigint[]) is
  'Marque comme lues les notifications de l''utilisateur connecté (toutes si p_ids est NULL).';
revoke all on function public.mark_notifications_read(bigint[]) from public, anon;
grant execute on function public.mark_notifications_read(bigint[]) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Résumé du portefeuille (module 1) : SECURITY INVOKER, la RLS limite aux
-- transactions de l'utilisateur connecté.
-- -----------------------------------------------------------------------------
create or replace function public.get_my_wallet_summary()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'received', coalesce(sum(t.amount) filter (where t.amount > 0 and t.type <> 'refund'), 0),
    'consumed', coalesce(-sum(t.amount) filter (where t.amount < 0), 0),
    'refunded', coalesce(sum(t.amount) filter (where t.type = 'refund'), 0),
    'count', count(*)
  )
  from public.credit_transactions t
  where t.user_id = (select auth.uid());
$$;

comment on function public.get_my_wallet_summary() is
  'Totaux du portefeuille de l''utilisateur connecté : reçus (hors remboursements), consommés, remboursés.';
revoke all on function public.get_my_wallet_summary() from public, anon;
grant execute on function public.get_my_wallet_summary() to authenticated;
