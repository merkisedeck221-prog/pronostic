-- Étape 6 : étape réelle d'une génération à la demande, lue par l'animation PRONEX AI.
-- Le serveur l'enregistre à chaque phase réelle du traitement (aucune simulation) ;
-- l'utilisateur la lit grâce à la politique existante (ses demandes uniquement).
-- Non destructif : deux colonnes facultatives, une contrainte, une fonction service_role.

alter table public.generation_requests
  add column if not exists stage text,
  add column if not exists stage_updated_at timestamptz;

alter table public.generation_requests
  add constraint generation_requests_stage_check
  check (stage is null or stage in ('starting', 'fixture', 'context', 'ai', 'validating', 'saving', 'waiting'));

comment on column public.generation_requests.stage is
  'Phase réelle en cours (starting, fixture, context, ai, validating, saving, waiting) ; null avant le démarrage.';

create or replace function public.set_generation_stage(p_request_id uuid, p_stage text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.generation_requests
     set stage = p_stage, stage_updated_at = now()
   where id = p_request_id
     and status in ('reserved', 'running');
$$;

revoke all on function public.set_generation_stage(uuid, text) from public, anon, authenticated;
grant execute on function public.set_generation_stage(uuid, text) to service_role;
