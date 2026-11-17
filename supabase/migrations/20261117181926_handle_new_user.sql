-- =============================================================================
-- Migration 8/8 — Déclencheur handle_new_user sur auth.users
-- Cahier des charges : section 5 (F1, RG-F1-1, RG-F1-4) et section 10.
--
-- À chaque création de compte :
--   1. crée la ligne profiles (display_name, country, phone, terms_accepted_at
--      lus dans raw_user_meta_data, envoyés par le formulaire d'inscription) ;
--   2. crée la ligne wallets (solde 0) ;
--   3. si app_settings.welcome_credits > 0, crédite ce bonus avec une
--      transaction « bonus » et le bon balance_after (une seule fois, RG-F1-4).
--
-- La promotion admin via ADMIN_EMAILS se fait côté serveur, à la connexion
-- (phase 3), pas ici.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta             jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_display_name   text;
  v_country        text;
  v_phone          text;
  v_terms_at       timestamptz;
  v_welcome        integer;
  v_balance        integer;
begin
  -- Nom d'affichage : métadonnée, sinon partie locale de l'e-mail, sinon « Utilisateur ».
  v_display_name := left(
    coalesce(
      nullif(btrim(meta ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Utilisateur'
    ),
    50
  );
  v_country := nullif(btrim(meta ->> 'country'), '');
  v_phone   := nullif(btrim(meta ->> 'phone'), '');

  -- RG-F1-1 : date d'acceptation des CGU + déclaration 18 ans.
  -- Le formulaire envoie terms_accepted_at (ISO 8601) ; à défaut terms_accepted = true.
  begin
    v_terms_at := nullif(meta ->> 'terms_accepted_at', '')::timestamptz;
  exception when others then
    v_terms_at := null;
  end;
  if v_terms_at is null and (meta ->> 'terms_accepted') = 'true' then
    v_terms_at := now();
  end if;

  insert into public.profiles (id, display_name, country, phone, terms_accepted_at)
  values (new.id, v_display_name, v_country, v_phone, v_terms_at);

  insert into public.wallets (user_id, balance)
  values (new.id, 0);

  -- RG-F1-4 : crédits de bienvenue (0 par défaut).
  select coalesce((s.value #>> '{}')::integer, 0)
    into v_welcome
    from public.app_settings s
   where s.key = 'welcome_credits';

  if coalesce(v_welcome, 0) > 0 then
    update public.wallets
       set balance = balance + v_welcome
     where user_id = new.id
    returning balance into v_balance;

    insert into public.credit_transactions
      (user_id, type, amount, balance_after, reference_type, reference_id, description)
    values
      (new.id, 'bonus', v_welcome, v_balance, 'welcome_bonus', new.id::text, 'Crédits de bienvenue');
  end if;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Déclencheur AFTER INSERT sur auth.users : crée profil, portefeuille et bonus de bienvenue.';

-- Fonction de déclencheur : jamais appelable via l'API.
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
