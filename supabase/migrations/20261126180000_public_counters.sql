-- Compteurs publics de la landing (brief, partie 5), calculés UNIQUEMENT à
-- partir de données réelles :
--   users     : comptes utilisateurs (rôle « user », hors admins, hors comptes
--               suspendus, hors adresses de test réservées @example.*) ;
--   won       : pronostics publiés et résolus « gagné » (jamais pending, lost,
--               void ni masqués) — pronostics match par match ;
--   analyses  : exécutions de PRONEX AI terminées et validées (ai_generation_runs
--               au statut success : sortie validée puis enregistrée).
-- Un compteur sous son seuil (réglages counters_min_*) est renvoyé à null : le
-- chiffre réel n'est pas exposé et la landing masque l'indicateur.

insert into public.app_settings (key, value, description, is_public) values
  ('counters_min_users', '100'::jsonb, 'Compteur « utilisateurs inscrits » de la page d''accueil : affiché à partir de ce nombre.', false),
  ('counters_min_won', '50'::jsonb, 'Compteur « pronostics gagnants » de la page d''accueil : affiché à partir de ce nombre.', false),
  ('counters_min_analyses', '50'::jsonb, 'Compteur « analyses PRONEX AI » de la page d''accueil : affiché à partir de ce nombre.', false)
on conflict (key) do nothing;

create or replace function public.get_public_counters()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_users    bigint;
  v_won      bigint;
  v_analyses bigint;
  v_min_users    bigint;
  v_min_won      bigint;
  v_min_analyses bigint;
begin
  select coalesce((select (value #>> '{}')::bigint from public.app_settings where key = 'counters_min_users'), 100) into v_min_users;
  select coalesce((select (value #>> '{}')::bigint from public.app_settings where key = 'counters_min_won'), 50) into v_min_won;
  select coalesce((select (value #>> '{}')::bigint from public.app_settings where key = 'counters_min_analyses'), 50) into v_min_analyses;

  select count(*) into v_users
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.role = 'user'
     and not p.is_banned
     and coalesce(u.email, '') !~* '@example\.(com|org|net)$';

  select count(*) into v_won
    from public.predictions
   where result = 'won' and status = 'published';

  select count(*) into v_analyses
    from public.ai_generation_runs
   where status = 'success';

  return jsonb_build_object(
    'users', case when v_users >= greatest(v_min_users, 1) then v_users end,
    'won', case when v_won >= greatest(v_min_won, 1) then v_won end,
    'analyses', case when v_analyses >= greatest(v_min_analyses, 1) then v_analyses end
  );
exception when others then
  -- Réglage illisible ou autre erreur : aucun chiffre plutôt qu'un chiffre faux.
  return jsonb_build_object('users', null, 'won', null, 'analyses', null);
end;
$$;

comment on function public.get_public_counters() is
  'Compteurs publics réels de la landing (utilisateurs, pronostics gagnants, analyses IA) ; null sous le seuil counters_min_*.';

revoke all on function public.get_public_counters() from public;
grant execute on function public.get_public_counters() to anon, authenticated, service_role;
