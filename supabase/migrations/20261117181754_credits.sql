-- =============================================================================
-- Migration 5/8 — Domaine « Crédits et paiements »
-- wallets, credit_transactions, unlocks, pricing_rules, credit_packs, topups
-- Cahier des charges : sections 5 (F5, F6), 6, 10 et 11.
--
-- RÈGLE ABSOLUE : wallets, credit_transactions, unlocks et topups ne sont JAMAIS
-- écrits via l'API. Les écritures passent par des fonctions SQL SECURITY DEFINER
-- (phases 7 et 8) ou par le serveur (service_role).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- wallets : solde de chaque utilisateur. Le solde ne peut jamais être négatif.
-- -----------------------------------------------------------------------------
create table public.wallets (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  balance     integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint wallets_balance_non_negative check (balance >= 0)
);

comment on table public.wallets is 'Solde en crédits (entiers). Modifié uniquement par des fonctions SQL.';

create trigger wallets_set_updated_at
  before update on public.wallets
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- credit_transactions : registre de tous les mouvements (montant signé + solde après).
-- -----------------------------------------------------------------------------
create table public.credit_transactions (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  type            public.transaction_type not null,
  amount          integer not null check (amount <> 0),
  balance_after   integer not null check (balance_after >= 0),
  reference_type  text,
  reference_id    text,
  description     text not null,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Cohérence du signe avec le type de mouvement.
  constraint credit_transactions_amount_sign check (
    (type = 'unlock' and amount < 0)
    or (type in ('topup', 'bonus', 'refund') and amount > 0)
    or type = 'admin_adjustment'
  )
);

comment on table public.credit_transactions is 'Registre des mouvements de crédits (section 6). Aucune écriture via l''API.';

create index credit_transactions_user_created_idx on public.credit_transactions (user_id, created_at desc);
create index credit_transactions_reference_idx on public.credit_transactions (reference_type, reference_id);
create index credit_transactions_created_by_idx on public.credit_transactions (created_by);

-- RG-F1-4 : le bonus de bienvenue n'est crédité qu'une seule fois par compte.
create unique index credit_transactions_welcome_once_idx
  on public.credit_transactions (user_id)
  where reference_type = 'welcome_bonus';

create trigger credit_transactions_set_updated_at
  before update on public.credit_transactions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- unlocks : accès achetés. market_code NULL = « match complet ».
-- Unicité (user_id, fixture_id, market_code) valeur NULL comprise (RG-F5-3).
-- -----------------------------------------------------------------------------
create table public.unlocks (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  fixture_id      bigint not null references public.fixtures (id) on delete restrict,
  market_code     text references public.markets (code) on delete restrict,
  credits_spent   integer not null check (credits_spent >= 0),
  transaction_id  bigint references public.credit_transactions (id) on delete set null,
  refunded_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- L'index unique sert aussi d'index de recherche sur user_id (colonne de tête).
  constraint unlocks_user_fixture_market_unique
    unique nulls not distinct (user_id, fixture_id, market_code)
);

comment on table public.unlocks is 'Accès achetés. market_code NULL = match complet. Aucune écriture via l''API.';

create index unlocks_fixture_id_idx on public.unlocks (fixture_id);
create index unlocks_transaction_id_idx on public.unlocks (transaction_id);
create index unlocks_market_code_idx on public.unlocks (market_code);

create trigger unlocks_set_updated_at
  before update on public.unlocks
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- pricing_rules : prix en crédits. competition_id NULL = règle générale.
-- scope 'market' : prix d'un marché ; scope 'match_bundle' : prix du match complet.
-- -----------------------------------------------------------------------------
create table public.pricing_rules (
  id              bigint generated always as identity primary key,
  scope           text not null check (scope in ('market', 'match_bundle')),
  market_code     text references public.markets (code) on delete cascade,
  competition_id  bigint references public.competitions (id) on delete cascade,
  credits         integer not null check (credits >= 0),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint pricing_rules_scope_market check (
    (scope = 'market' and market_code is not null)
    or (scope = 'match_bundle' and market_code is null)
  ),
  -- Une seule règle par (portée, marché, compétition), règle générale comprise.
  constraint pricing_rules_unique unique nulls not distinct (scope, market_code, competition_id)
);

comment on table public.pricing_rules is 'Règles de prix (section 6). Lecture publique des règles actives.';

create index pricing_rules_competition_id_idx on public.pricing_rules (competition_id);
create index pricing_rules_market_code_idx on public.pricing_rules (market_code);

create trigger pricing_rules_set_updated_at
  before update on public.pricing_rules
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- credit_packs : packs de recharge (prix en XOF).
-- -----------------------------------------------------------------------------
create table public.credit_packs (
  id             bigint generated always as identity primary key,
  name           text not null unique,
  credits        integer not null check (credits > 0),
  bonus_credits  integer not null default 0 check (bonus_credits >= 0),
  price_xof      integer not null check (price_xof > 0),
  is_active      boolean not null default true,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.credit_packs is 'Packs de recharge. Lecture publique des packs actifs.';

create trigger credit_packs_set_updated_at
  before update on public.credit_packs
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- topups : recharges. Créées « pending », créditées une seule fois (RG-F6-1).
-- -----------------------------------------------------------------------------
create table public.topups (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  pack_id        bigint references public.credit_packs (id) on delete set null,
  credits        integer not null check (credits > 0),
  bonus_credits  integer not null default 0 check (bonus_credits >= 0),
  amount_xof     integer not null check (amount_xof > 0),
  provider       text not null,
  -- Référence du fournisseur de paiement : unique (idempotence, RG-F6-1).
  provider_ref   text unique,
  status         public.topup_status not null default 'pending',
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.topups is 'Recharges. Écriture serveur uniquement.';

create index topups_user_created_idx on public.topups (user_id, created_at desc);
create index topups_pack_id_idx on public.topups (pack_id);
create index topups_status_idx on public.topups (status) where status = 'pending';

create trigger topups_set_updated_at
  before update on public.topups
  for each row execute function public.set_updated_at();
