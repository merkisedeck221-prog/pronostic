-- =============================================================================
-- Phase 6 — Enregistrement des pronostics générés par l'IA (section 8, étape 5)
--
-- save_ai_generation() écrit, DANS UNE SEULE TRANSACTION :
--   1. une ligne par marché ACTIF dans predictions (published / pending) ;
--   2. l'analyse globale dans prediction_analyses ;
--   3. la trace dans ai_generation_runs (succès, métriques).
-- Mode « initial » : refuse si le match a déjà des pronostics (jamais de
-- régénération silencieuse). Mode « regenerate » (admin) : refuse s'il existe
-- un déblocage ou un pronostic figé (RG-F5-6), archive l'ancienne version dans
-- prediction_revisions puis remplace (version + 1).
-- Exécutable uniquement avec la clé secrète (service_role).
-- =============================================================================

create or replace function public.save_ai_generation(
  p_fixture_id  bigint,
  p_mode        text,
  p_analysis    jsonb,
  p_predictions jsonb,
  p_run         jsonb,
  p_changed_by  uuid default null,
  p_reason      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item     jsonb;
  v_saved    integer := 0;
  v_skipped  text[] := '{}';
  v_run_id   bigint;
  v_version  text := coalesce(p_run ->> 'prompt_version', 'v1');
begin
  if p_mode not in ('initial', 'regenerate') then
    raise exception 'Mode inconnu : %', p_mode;
  end if;
  if jsonb_typeof(p_predictions) <> 'array' then
    raise exception 'p_predictions doit être un tableau';
  end if;

  -- Verrou sur le match : deux générations simultanées sont sérialisées.
  perform 1 from public.fixtures where id = p_fixture_id for update;
  if not found then
    raise exception 'Match % introuvable', p_fixture_id;
  end if;

  if p_mode = 'initial' then
    if exists (select 1 from public.predictions where fixture_id = p_fixture_id) then
      raise exception 'already_has_predictions: le match % a déjà des pronostics', p_fixture_id using errcode = 'P0001';
    end if;
  else
    if exists (select 1 from public.unlocks where fixture_id = p_fixture_id) then
      raise exception 'fixture_has_unlocks: au moins un déblocage existe sur le match %', p_fixture_id using errcode = 'P0001';
    end if;
    if exists (select 1 from public.predictions where fixture_id = p_fixture_id and is_locked) then
      raise exception 'prediction_locked: un pronostic du match % est figé', p_fixture_id using errcode = 'P0001';
    end if;
    -- Archive de la version actuelle (pronostic + analyse globale).
    insert into public.prediction_revisions (prediction_id, previous, changed_by, reason)
    select p.id,
           to_jsonb(p) || jsonb_build_object(
             'analysis', (select to_jsonb(a) from public.prediction_analyses a where a.fixture_id = p_fixture_id)
           ),
           p_changed_by,
           coalesce(p_reason, 'Régénération')
      from public.predictions p
     where p.fixture_id = p_fixture_id;
  end if;

  for v_item in select value from jsonb_array_elements(p_predictions) loop
    -- Seuls les marchés actifs sont enregistrés.
    if not exists (select 1 from public.markets m where m.code = v_item ->> 'market_code' and m.is_active) then
      v_skipped := v_skipped || (v_item ->> 'market_code');
      continue;
    end if;

    insert into public.predictions (
      fixture_id, market_code, selection, selection_label, probability, probabilities,
      confidence, reasoning, status, result, is_locked, version, prompt_version, settled_at
    ) values (
      p_fixture_id,
      v_item ->> 'market_code',
      v_item ->> 'selection',
      v_item ->> 'selection_label',
      (v_item ->> 'probability')::smallint,
      nullif(v_item -> 'probabilities', 'null'::jsonb),
      (v_item ->> 'confidence')::public.confidence_level,
      v_item ->> 'reasoning',
      'published',
      'pending',
      false,
      1,
      v_version,
      null
    )
    on conflict (fixture_id, market_code) do update set
      selection       = excluded.selection,
      selection_label = excluded.selection_label,
      probability     = excluded.probability,
      probabilities   = excluded.probabilities,
      confidence      = excluded.confidence,
      reasoning       = excluded.reasoning,
      status          = 'published',
      result          = 'pending',
      settled_at      = null,
      version         = public.predictions.version + 1,
      prompt_version  = excluded.prompt_version;

    v_saved := v_saved + 1;
  end loop;

  insert into public.prediction_analyses (fixture_id, summary, key_factors, model, prompt_version)
  values (
    p_fixture_id,
    p_analysis ->> 'summary',
    coalesce(p_analysis -> 'key_factors', '[]'::jsonb),
    coalesce(p_run ->> 'model', 'inconnu'),
    v_version
  )
  on conflict (fixture_id) do update set
    summary        = excluded.summary,
    key_factors    = excluded.key_factors,
    model          = excluded.model,
    prompt_version = excluded.prompt_version;

  insert into public.ai_generation_runs (
    fixture_id, status, model, prompt_version, input_tokens, output_tokens, cost_estimate_usd, duration_ms, error
  ) values (
    p_fixture_id,
    'success',
    coalesce(p_run ->> 'model', 'inconnu'),
    v_version,
    nullif(p_run ->> 'input_tokens', '')::integer,
    nullif(p_run ->> 'output_tokens', '')::integer,
    nullif(p_run ->> 'cost_estimate_usd', '')::numeric,
    nullif(p_run ->> 'duration_ms', '')::integer,
    case when cardinality(v_skipped) > 0 then 'Marchés inactifs ignorés : ' || array_to_string(v_skipped, ', ') end
  )
  returning id into v_run_id;

  return jsonb_build_object('saved', v_saved, 'skipped', to_jsonb(v_skipped), 'run_id', v_run_id);
end;
$$;

comment on function public.save_ai_generation(bigint, text, jsonb, jsonb, jsonb, uuid, text) is
  'Enregistre atomiquement pronostics (marchés actifs), analyse et trace de génération IA. Serveur uniquement.';

revoke all on function public.save_ai_generation(bigint, text, jsonb, jsonb, jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.save_ai_generation(bigint, text, jsonb, jsonb, jsonb, uuid, text) to service_role;

-- Index pour les tâches : générations du jour, dossiers par match.
create index if not exists ai_generation_runs_fixture_created_idx on public.ai_generation_runs (fixture_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Planification (UTC) : toutes les heures, génération 20 min après les dossiers.
-- -----------------------------------------------------------------------------
select cron.schedule('build-contexts',       '11 * * * *', $$select private.invoke_sync_job('build-contexts')$$);
select cron.schedule('generate-predictions', '31 * * * *', $$select private.invoke_sync_job('generate-predictions')$$);
