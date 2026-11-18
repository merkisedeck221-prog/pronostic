-- =============================================================================
-- Phase 11 — Recette : durcissement trouvé par l'audit de sécurité
--
-- 1. profiles.created_at n'était pas protégé : un utilisateur pouvait antidater
--    son inscription (statistiques admin faussées). Désormais non modifiable
--    via l'API (anon / authenticated), comme role, is_banned, terms_accepted_at.
-- 2. profiles.timezone acceptait n'importe quel texte, sans limite de longueur :
--    contrainte de forme (identifiant IANA, 64 caractères max).
-- 3. public.rls_auto_enable() (fonction de Supabase) était exécutable par anon
--    et authenticated : droit retiré (elle ne sert qu'en déclencheur d'événement).
-- =============================================================================

create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'profiles.id ne peut pas être modifié' using errcode = '42501';
  end if;

  -- Date d'inscription : jamais modifiable par l'API, même par un admin.
  if new.created_at is distinct from old.created_at and current_user in ('anon', 'authenticated') then
    raise exception 'Modification interdite : created_at est protégé' using errcode = '42501';
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

alter table public.profiles
  add constraint profiles_timezone_format
  check (char_length(timezone) between 3 and 64 and timezone ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+){0,2}$');

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
