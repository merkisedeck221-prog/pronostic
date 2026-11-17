-- =============================================================================
-- Migration 2/8 — Domaine « Comptes » : profiles, admin_audit_log, is_admin()
-- Cahier des charges : sections 5 (F1, F9) et 10.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles : profil applicatif lié 1-1 à auth.users.
-- Créé automatiquement par le déclencheur handle_new_user (migration 8).
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  display_name      text not null check (char_length(display_name) between 1 and 50),
  country           text check (country is null or char_length(country) between 2 and 56),
  phone             text check (phone is null or phone ~ '^\+?[0-9 ]{6,20}$'),
  role              public.user_role not null default 'user',
  is_banned         boolean not null default false,
  -- RG-F1-1 : date d'acceptation des CGU et de la déclaration « 18 ans ou plus ».
  terms_accepted_at timestamptz,
  timezone          text not null default 'Africa/Porto-Novo',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.profiles is 'Profil de chaque compte (1-1 avec auth.users).';
comment on column public.profiles.role is 'user ou admin. Jamais modifiable par l''utilisateur lui-même (RG-F1-3).';
comment on column public.profiles.is_banned is 'Compte suspendu (RG-F1-2). Non modifiable par l''utilisateur.';

create index profiles_role_idx on public.profiles (role) where role = 'admin';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- is_admin() : vrai si l'utilisateur courant (auth.uid()) est un admin non suspendu.
-- SECURITY DEFINER pour lire profiles sans dépendre de la RLS (évite la récursion
-- des politiques qui l'utilisent). STABLE : évaluée une fois par requête.
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and not p.is_banned
  );
$$;

comment on function public.is_admin() is
  'Vrai si auth.uid() correspond à un profil admin non suspendu. Utilisée par les politiques RLS.';

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Protection des colonnes sensibles de profiles (RG-F1-1, RG-F1-2, RG-F1-3).
-- Un utilisateur peut modifier son profil, mais PAS : role, is_banned,
-- terms_accepted_at, id. Seuls un AUTRE admin (via l'API) ou le serveur
-- (service_role, SQL direct) peuvent les changer. Un admin ne peut pas modifier
-- son propre rôle ni sa propre suspension.
-- -----------------------------------------------------------------------------
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'profiles.id ne peut pas être modifié' using errcode = '42501';
  end if;

  if (new.role is distinct from old.role
      or new.is_banned is distinct from old.is_banned
      or new.terms_accepted_at is distinct from old.terms_accepted_at)
     -- Rôles des requêtes de l'API : anon et authenticated. Le serveur (service_role)
     -- et les migrations (postgres) ne sont pas concernés.
     and current_user in ('anon', 'authenticated')
     and (not public.is_admin() or old.id = (select auth.uid()))
  then
    raise exception 'Modification interdite : role, is_banned et terms_accepted_at sont protégés'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger profiles_protect_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- -----------------------------------------------------------------------------
-- admin_audit_log : journal des actions sensibles de l'admin (RG-F9-1).
-- Écrit uniquement par des fonctions serveur (aucune écriture via l'API).
-- -----------------------------------------------------------------------------
create table public.admin_audit_log (
  id          bigint generated always as identity primary key,
  admin_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  entity      text not null,
  entity_id   text,
  before      jsonb,
  after       jsonb,
  reason      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.admin_audit_log is 'Journal d''audit : qui, quoi, quand, avant et après (RG-F9-1).';

create index admin_audit_log_created_at_idx on public.admin_audit_log (created_at desc);
create index admin_audit_log_entity_idx on public.admin_audit_log (entity, entity_id);
create index admin_audit_log_admin_id_idx on public.admin_audit_log (admin_id);

create trigger admin_audit_log_set_updated_at
  before update on public.admin_audit_log
  for each row execute function public.set_updated_at();
