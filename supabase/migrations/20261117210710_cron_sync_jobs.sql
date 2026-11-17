-- =============================================================================
-- Phase 4 — Planification des tâches de synchronisation (Supabase Cron)
-- Cahier des charges, section 7 « Tâches planifiées ».
--
-- pg_cron déclenche, pg_net appelle la route protégée de l'application :
--   POST <app_url>/api/cron/<tâche>   Authorization: Bearer <cron_secret>
--
-- AUCUN SECRET DANS CE FICHIER. Les valeurs sont lues dans Supabase Vault :
--   app_url               URL de production de l'application (sans / final)
--   cron_secret           même valeur que CRON_SECRET sur Vercel
--   vercel_bypass_secret  (facultatif) « Protection Bypass for Automation » Vercel
-- Tant que app_url ou cron_secret manquent, les tâches ne font rien (avertissement).
-- Commandes d'enregistrement : docs/sync.md.
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Schéma non exposé par l'API REST : fonctions internes.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.invoke_sync_job(job_name text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app_url    text;
  v_secret     text;
  v_bypass     text;
  v_headers    jsonb;
  v_request_id bigint;
begin
  if job_name !~ '^[a-z][a-z0-9-]{1,40}$' then
    raise exception 'Nom de tâche invalide : %', job_name;
  end if;

  select decrypted_secret into v_app_url from vault.decrypted_secrets where name = 'app_url';
  select decrypted_secret into v_secret  from vault.decrypted_secrets where name = 'cron_secret';
  select decrypted_secret into v_bypass  from vault.decrypted_secrets where name = 'vercel_bypass_secret';

  if v_app_url is null or v_secret is null then
    raise warning 'invoke_sync_job(%): secrets app_url / cron_secret absents de Vault, tâche ignorée', job_name;
    return null;
  end if;

  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || v_secret
  );
  if v_bypass is not null and v_bypass <> '' then
    v_headers := v_headers || jsonb_build_object('x-vercel-protection-bypass', v_bypass);
  end if;

  select net.http_post(
    url := rtrim(v_app_url, '/') || '/api/cron/' || job_name,
    headers := v_headers,
    body := jsonb_build_object('source', 'pg_cron'),
    timeout_milliseconds := 60000
  ) into v_request_id;

  return v_request_id;
end;
$$;

comment on function private.invoke_sync_job(text) is
  'Appelle /api/cron/<job> de l''application avec CRON_SECRET (lu dans Vault).';

revoke all on function private.invoke_sync_job(text) from public, anon, authenticated;

-- Planification (UTC). cron.schedule avec un nom met à jour la tâche existante.
-- Minutes décalées pour éviter les pics de l'heure pile.
select cron.schedule('sync-competitions', '17 3 * * 1',    $$select private.invoke_sync_job('sync-competitions')$$); -- 1 fois par semaine (lundi)
select cron.schedule('sync-fixtures',     '7 5,17 * * *',  $$select private.invoke_sync_job('sync-fixtures')$$);     -- 2 fois par jour
select cron.schedule('sync-standings',    '37 5 * * *',    $$select private.invoke_sync_job('sync-standings')$$);    -- 1 fois par jour
select cron.schedule('sync-results',      '*/15 * * * *',  $$select private.invoke_sync_job('sync-results')$$);      -- toutes les 15 min
