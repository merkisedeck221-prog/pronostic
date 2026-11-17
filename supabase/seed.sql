-- =============================================================================
-- Données de départ (cahier des charges, sections 5-F4 et 6).
--
-- Idempotent : relançable sans effet de bord. ON CONFLICT DO NOTHING ne
-- réécrase JAMAIS une valeur déjà modifiée depuis l'administration.
-- Aucune compétition ici : elles sont ajoutées en phase 4, après vérification
-- des identifiants API-Football.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Marchés (F4)
-- -----------------------------------------------------------------------------
insert into public.markets (code, label, description, is_active, sort_order) values
  ('MATCH_RESULT',   'Résultat du match (1N2)',  'Victoire domicile (1), match nul (N) ou victoire extérieur (2), au temps réglementaire.', true, 1),
  ('EXACT_SCORE',    'Score exact',               'Score exact au temps réglementaire.',                                                  true, 2),
  ('OVER_UNDER_2_5', 'Plus/Moins de 2,5 buts',    'Plus de 2,5 buts (3 ou plus) ou moins de 2,5 buts (2 ou moins) au temps réglementaire.', true, 3),
  ('BTTS',           'Les deux équipes marquent', 'Les deux équipes marquent au moins un but (oui) ou non, au temps réglementaire.',      true, 4)
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- Règles de prix générales (section 6) : 4 marchés + match complet.
-- competition_id NULL = règle générale.
-- -----------------------------------------------------------------------------
insert into public.pricing_rules (scope, market_code, competition_id, credits, is_active) values
  ('market',       'MATCH_RESULT',   null, 2, true),
  ('market',       'OVER_UNDER_2_5', null, 2, true),
  ('market',       'BTTS',           null, 2, true),
  ('market',       'EXACT_SCORE',    null, 3, true),
  ('match_bundle', null,             null, 7, true)
on conflict (scope, market_code, competition_id) do nothing;

-- -----------------------------------------------------------------------------
-- Packs de recharge (section 6) — valeurs de départ, prix en XOF.
-- -----------------------------------------------------------------------------
insert into public.credit_packs (name, credits, bonus_credits, price_xof, is_active, sort_order) values
  ('Découverte', 10,  0, 1000, true, 1),
  ('Standard',   25,  3, 2500, true, 2),
  ('Premium',    60, 10, 5000, true, 3)
on conflict (name) do nothing;

-- -----------------------------------------------------------------------------
-- Paramètres (section 6, app_settings)
-- -----------------------------------------------------------------------------
insert into public.app_settings (key, value, description, is_public) values
  ('pricing_mode',            '"both"'::jsonb, 'Modes proposés à l''utilisateur : per_market, per_match ou both.',                 true),
  ('welcome_credits',         '0'::jsonb,      'Crédits offerts à l''inscription (0 = désactivé).',                               true),
  ('prediction_window_hours', '48'::jsonb,     'Délai (heures) avant le coup d''envoi à partir duquel le pronostic est généré.', true),
  ('refund_on_cancel',        'true'::jsonb,   'Remboursement automatique des matchs annulés ou reportés de plus de 48 h.',      true),
  ('maintenance_mode',        'false'::jsonb,  'Bloque les déblocages et les recharges, avec un message.',                       true),
  ('reveal_after_match',      'true'::jsonb,   'Rend publics les pronostics d''un match terminé (RG-F4-4).',                     true)
on conflict (key) do nothing;
