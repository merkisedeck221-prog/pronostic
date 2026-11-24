// Fichier généré depuis le schéma Supabase — NE PAS MODIFIER À LA MAIN.
// Régénérer après chaque migration : npm run db:types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: number
          reason: string | null
          updated_at: string
        }
        Insert: {
          action: string
          admin_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: never
          reason?: string | null
          updated_at?: string
        }
        Update: {
          action?: string
          admin_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: never
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          error: string | null
          expires_at: string
          fixture_id: number
          hold_transaction_id: number | null
          id: string
          idempotency_key: string
          market_code: string | null
          price: number
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          expires_at?: string
          fixture_id: number
          hold_transaction_id?: number | null
          id?: string
          idempotency_key: string
          market_code?: string | null
          price: number
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          expires_at?: string
          fixture_id?: number
          hold_transaction_id?: number | null
          id?: string
          idempotency_key?: string
          market_code?: string | null
          price?: number
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      health_reports: {
        Row: {
          anomalies: Json
          created_at: string
          created_by: string | null
          id: number
          status: string
          updated_at: string
        }
        Insert: {
          anomalies?: Json
          created_at?: string
          created_by?: string | null
          id?: never
          status: string
          updated_at?: string
        }
        Update: {
          anomalies?: Json
          created_at?: string
          created_by?: string | null
          id?: never
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generation_runs: {
        Row: {
          cost_estimate_usd: number | null
          created_at: string
          duration_ms: number | null
          error: string | null
          fixture_id: number | null
          id: number
          input_tokens: number | null
          model: string
          output_tokens: number | null
          prompt_version: string
          status: Database["public"]["Enums"]["run_status"]
          updated_at: string
        }
        Insert: {
          cost_estimate_usd?: number | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          fixture_id?: number | null
          id?: never
          input_tokens?: number | null
          model: string
          output_tokens?: number | null
          prompt_version: string
          status: Database["public"]["Enums"]["run_status"]
          updated_at?: string
        }
        Update: {
          cost_estimate_usd?: number | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          fixture_id?: number | null
          id?: never
          input_tokens?: number | null
          model?: string
          output_tokens?: number | null
          prompt_version?: string
          status?: Database["public"]["Enums"]["run_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_generation_runs_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string
          description: string | null
          is_public: boolean
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          is_public?: boolean
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          is_public?: boolean
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      competitions: {
        Row: {
          api_league_id: number
          category: Database["public"]["Enums"]["competition_category"]
          country: string | null
          coverage: Json
          created_at: string
          current_season: number | null
          id: number
          is_active: boolean
          logo_url: string | null
          name: string
          slug: string
          sort_order: number
          type: string
          updated_at: string
        }
        Insert: {
          api_league_id: number
          category: Database["public"]["Enums"]["competition_category"]
          country?: string | null
          coverage?: Json
          created_at?: string
          current_season?: number | null
          id?: never
          is_active?: boolean
          logo_url?: string | null
          name: string
          slug: string
          sort_order?: number
          type: string
          updated_at?: string
        }
        Update: {
          api_league_id?: number
          category?: Database["public"]["Enums"]["competition_category"]
          country?: string | null
          coverage?: Json
          created_at?: string
          current_season?: number | null
          id?: never
          is_active?: boolean
          logo_url?: string | null
          name?: string
          slug?: string
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_packs: {
        Row: {
          bonus_credits: number
          created_at: string
          credits: number
          id: number
          is_active: boolean
          name: string
          price_xof: number
          sort_order: number
          updated_at: string
          available_from: string | null
          available_until: string | null
          description: string | null
        }
        Insert: {
          bonus_credits?: number
          created_at?: string
          credits: number
          id?: never
          is_active?: boolean
          name: string
          price_xof: number
          sort_order?: number
          updated_at?: string
          available_from?: string | null
          available_until?: string | null
          description?: string | null
        }
        Update: {
          bonus_credits?: number
          created_at?: string
          credits?: number
          id?: never
          is_active?: boolean
          name?: string
          price_xof?: number
          sort_order?: number
          updated_at?: string
          available_from?: string | null
          available_until?: string | null
          description?: string | null
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          created_by: string | null
          description: string
          id: number
          reference_id: string | null
          reference_type: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          created_by?: string | null
          description: string
          id?: never
          reference_id?: string | null
          reference_type?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          created_by?: string | null
          description?: string
          id?: never
          reference_id?: string | null
          reference_type?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fixtures: {
        Row: {
          api_fixture_id: number
          away_team_id: number
          cards_away: number | null
          cards_home: number | null
          competition_id: number
          corners_away: number | null
          corners_home: number | null
          created_at: string
          ft_away: number | null
          ft_home: number | null
          goals_away: number | null
          goals_home: number | null
          home_team_id: number
          ht_away: number | null
          ht_home: number | null
          id: number
          is_published: boolean
          kickoff_at: string
          last_synced_at: string | null
          original_kickoff_at: string | null
          round: string | null
          season: number
          stats_attempts: number
          stats_synced_at: string | null
          status_long: string | null
          status_short: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          api_fixture_id: number
          away_team_id: number
          cards_away?: number | null
          cards_home?: number | null
          competition_id: number
          corners_away?: number | null
          corners_home?: number | null
          created_at?: string
          ft_away?: number | null
          ft_home?: number | null
          goals_away?: number | null
          goals_home?: number | null
          home_team_id: number
          ht_away?: number | null
          ht_home?: number | null
          id?: never
          is_published?: boolean
          kickoff_at: string
          last_synced_at?: string | null
          original_kickoff_at?: string | null
          round?: string | null
          season: number
          stats_attempts?: number
          stats_synced_at?: string | null
          status_long?: string | null
          status_short?: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          api_fixture_id?: number
          away_team_id?: number
          cards_away?: number | null
          cards_home?: number | null
          competition_id?: number
          corners_away?: number | null
          corners_home?: number | null
          created_at?: string
          ft_away?: number | null
          ft_home?: number | null
          goals_away?: number | null
          goals_home?: number | null
          home_team_id?: number
          ht_away?: number | null
          ht_home?: number | null
          id?: never
          is_published?: boolean
          kickoff_at?: string
          last_synced_at?: string | null
          original_kickoff_at?: string | null
          round?: string | null
          season?: number
          stats_attempts?: number
          stats_synced_at?: string | null
          status_long?: string | null
          status_short?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fixtures_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      markets: {
        Row: {
          code: string
          created_at: string
          description: string | null
          is_active: boolean
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          is_active?: boolean
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          is_active?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      match_contexts: {
        Row: {
          created_at: string
          fetched_at: string
          fixture_id: number
          id: number
          raw: Json
          summary: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          fetched_at?: string
          fixture_id: number
          id?: never
          raw: Json
          summary: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          fetched_at?: string
          fixture_id?: number
          id?: never
          raw?: Json
          summary?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_contexts_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: true
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          dedupe_key: string | null
          id: number
          kind: string
          link: string | null
          read_at: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          dedupe_key?: string | null
          id?: never
          kind: string
          link?: string | null
          read_at?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          dedupe_key?: string | null
          id?: never
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_analyses: {
        Row: {
          created_at: string
          fixture_id: number
          id: number
          key_factors: Json
          model: string
          prompt_version: string
          summary: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fixture_id: number
          id?: never
          key_factors?: Json
          model: string
          prompt_version: string
          summary: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fixture_id?: number
          id?: never
          key_factors?: Json
          model?: string
          prompt_version?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prediction_analyses_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: true
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_revisions: {
        Row: {
          changed_by: string | null
          created_at: string
          id: number
          prediction_id: number
          previous: Json
          reason: string | null
          updated_at: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: never
          prediction_id: number
          previous: Json
          reason?: string | null
          updated_at?: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: never
          prediction_id?: number
          previous?: Json
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prediction_revisions_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prediction_revisions_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: false
            referencedRelation: "predictions"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          confidence: Database["public"]["Enums"]["confidence_level"]
          created_at: string
          fixture_id: number
          id: number
          is_locked: boolean
          market_code: string
          probabilities: Json | null
          probability: number
          prompt_version: string
          reasoning: string
          result: Database["public"]["Enums"]["prediction_result"]
          selection: string
          selection_label: string
          settled_at: string | null
          status: Database["public"]["Enums"]["prediction_status"]
          updated_at: string
          version: number
        }
        Insert: {
          confidence: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          fixture_id: number
          id?: never
          is_locked?: boolean
          market_code: string
          probabilities?: Json | null
          probability: number
          prompt_version: string
          reasoning: string
          result?: Database["public"]["Enums"]["prediction_result"]
          selection: string
          selection_label: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["prediction_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          confidence?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          fixture_id?: number
          id?: never
          is_locked?: boolean
          market_code?: string
          probabilities?: Json | null
          probability?: number
          prompt_version?: string
          reasoning?: string
          result?: Database["public"]["Enums"]["prediction_result"]
          selection?: string
          selection_label?: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["prediction_status"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "predictions_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_market_code_fkey"
            columns: ["market_code"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["code"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          competition_id: number | null
          created_at: string
          credits: number
          id: number
          is_active: boolean
          market_code: string | null
          scope: string
          updated_at: string
        }
        Insert: {
          competition_id?: number | null
          created_at?: string
          credits: number
          id?: never
          is_active?: boolean
          market_code?: string | null
          scope: string
          updated_at?: string
        }
        Update: {
          competition_id?: number | null
          created_at?: string
          credits?: number
          id?: never
          is_active?: boolean
          market_code?: string | null
          scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_rules_market_code_fkey"
            columns: ["market_code"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["code"]
          },
        ]
      }
      profiles: {
        Row: {
          country: string | null
          created_at: string
          display_name: string
          id: string
          is_banned: boolean
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          terms_accepted_at: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          display_name: string
          id: string
          is_banned?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          terms_accepted_at?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_banned?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          terms_accepted_at?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      promo_attempts: {
        Row: {
          created_at: string
          id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: number
          is_active: boolean
          kind: string
          max_uses: number | null
          max_uses_per_user: number
          min_price_xof: number
          starts_at: string | null
          updated_at: string
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: never
          is_active?: boolean
          kind: string
          max_uses?: number | null
          max_uses_per_user?: number
          min_price_xof?: number
          starts_at?: string | null
          updated_at?: string
          value: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: never
          is_active?: boolean
          kind?: string
          max_uses?: number | null
          max_uses_per_user?: number
          min_price_xof?: number
          starts_at?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      standings: {
        Row: {
          competition_id: number
          created_at: string
          drawn: number
          form: string | null
          goals_against: number
          goals_for: number
          group_name: string
          id: number
          lost: number
          played: number
          points: number
          rank: number
          season: number
          team_id: number
          updated_at: string
          won: number
        }
        Insert: {
          competition_id: number
          created_at?: string
          drawn?: number
          form?: string | null
          goals_against?: number
          goals_for?: number
          group_name?: string
          id?: never
          lost?: number
          played?: number
          points?: number
          rank: number
          season: number
          team_id: number
          updated_at?: string
          won?: number
        }
        Update: {
          competition_id?: number
          created_at?: string
          drawn?: number
          form?: string | null
          goals_against?: number
          goals_for?: number
          group_name?: string
          id?: never
          lost?: number
          played?: number
          points?: number
          rank?: number
          season?: number
          team_id?: number
          updated_at?: string
          won?: number
        }
        Relationships: [
          {
            foreignKeyName: "standings_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_runs: {
        Row: {
          api_calls: number
          created_at: string
          error: string | null
          finished_at: string | null
          id: number
          items_processed: number
          job: string
          quota_remaining: number | null
          started_at: string
          status: Database["public"]["Enums"]["run_status"]
          updated_at: string
        }
        Insert: {
          api_calls?: number
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: never
          items_processed?: number
          job: string
          quota_remaining?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["run_status"]
          updated_at?: string
        }
        Update: {
          api_calls?: number
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: never
          items_processed?: number
          job?: string
          quota_remaining?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["run_status"]
          updated_at?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          api_team_id: number
          country: string | null
          created_at: string
          id: number
          is_national: boolean
          logo_url: string | null
          name: string
          short_name: string | null
          updated_at: string
        }
        Insert: {
          api_team_id: number
          country?: string | null
          created_at?: string
          id?: never
          is_national?: boolean
          logo_url?: string | null
          name: string
          short_name?: string | null
          updated_at?: string
        }
        Update: {
          api_team_id?: number
          country?: string | null
          created_at?: string
          id?: never
          is_national?: boolean
          logo_url?: string | null
          name?: string
          short_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      topups: {
        Row: {
          amount_xof: number
          bonus_credits: number
          completed_at: string | null
          created_at: string
          credits: number
          id: string
          pack_id: number | null
          provider: string
          provider_ref: string | null
          status: Database["public"]["Enums"]["topup_status"]
          updated_at: string
          user_id: string
          promo_bonus_credits: number
          promo_code_id: number | null
        }
        Insert: {
          amount_xof: number
          bonus_credits?: number
          completed_at?: string | null
          created_at?: string
          credits: number
          id?: string
          pack_id?: number | null
          provider: string
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["topup_status"]
          updated_at?: string
          user_id: string
          promo_bonus_credits?: number
          promo_code_id?: number | null
        }
        Update: {
          amount_xof?: number
          bonus_credits?: number
          completed_at?: string | null
          created_at?: string
          credits?: number
          id?: string
          pack_id?: number | null
          provider?: string
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["topup_status"]
          updated_at?: string
          user_id?: string
          promo_bonus_credits?: number
          promo_code_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "topups_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "credit_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      unlock_partial_refunds: {
        Row: {
          created_at: string
          credits: number
          fixture_id: number
          id: number
          market_code: string
          transaction_id: number | null
          unlock_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits: number
          fixture_id: number
          id?: never
          market_code: string
          transaction_id?: number | null
          unlock_id: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          fixture_id?: number
          id?: never
          market_code?: string
          transaction_id?: number | null
          unlock_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unlock_partial_refunds_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unlock_partial_refunds_market_code_fkey"
            columns: ["market_code"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "unlock_partial_refunds_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "credit_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unlock_partial_refunds_unlock_id_fkey"
            columns: ["unlock_id"]
            isOneToOne: false
            referencedRelation: "unlocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unlock_partial_refunds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      unlocks: {
        Row: {
          created_at: string
          credits_spent: number
          fixture_id: number
          id: number
          market_code: string | null
          refunded_at: string | null
          transaction_id: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_spent: number
          fixture_id: number
          id?: never
          market_code?: string | null
          refunded_at?: string | null
          transaction_id?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_spent?: number
          fixture_id?: number
          id?: never
          market_code?: string | null
          refunded_at?: string | null
          transaction_id?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unlocks_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unlocks_market_code_fkey"
            columns: ["market_code"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "unlocks_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "credit_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unlocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_ai_stats: { Args: never; Returns: Json }
      admin_consistency_check: { Args: never; Returns: Json }
      admin_cron_status: { Args: never; Returns: Json }
      admin_edit_prediction_text: {
        Args: { p_prediction_id: number; p_reason: string; p_reasoning: string }
        Returns: Json
      }
      admin_generation_requests: { Args: { p_limit?: number }; Returns: Json }
      admin_get_user: { Args: { p_user_id: string }; Returns: Json }
      admin_list_users: {
        Args: { p_limit?: number; p_offset?: number; p_search?: string; p_sort?: string; p_status?: string }
        Returns: Json
      }
      admin_log_action: {
        Args: { p_action: string; p_after: Json; p_before: Json; p_entity: string; p_entity_id: string; p_reason?: string }
        Returns: Json
      }
      admin_overview: { Args: never; Returns: Json }
      admin_refund_fixture: { Args: { p_fixture_id: number; p_reason: string }; Returns: Json }
      admin_reverse_transaction: { Args: { p_reason: string; p_transaction_id: number }; Returns: Json }
      admin_revenue: { Args: { p_from: string; p_to: string }; Returns: Json }
      admin_set_prediction_status: {
        Args: { p_prediction_id: number; p_reason: string; p_status: Database["public"]["Enums"]["prediction_status"] }
        Returns: Json
      }
      admin_set_user_banned: { Args: { p_banned: boolean; p_reason: string; p_user_id: string }; Returns: Json }
      admin_set_user_role: {
        Args: { p_reason: string; p_role: Database["public"]["Enums"]["user_role"]; p_user_id: string }
        Returns: Json
      }
      admin_settle_fixture: { Args: { p_fixture_id: number }; Returns: Json }
      admin_run_health_check: { Args: never; Returns: Json }
      request_generation: {
        Args: { p_fixture_id: number; p_idempotency_key: string; p_market_code: string }
        Returns: Json
      }
      run_health_check: { Args: never; Returns: Json }
      admin_adjust_balance: {
        Args: { p_amount: number; p_reason: string; p_user_id: string }
        Returns: Json
      }
      apply_topup: {
        Args: {
          p_status: Database["public"]["Enums"]["topup_status"]
          p_topup_id: string
        }
        Returns: Json
      }
      complete_generation: { Args: { p_request_id: string }; Returns: Json }
      create_topup: {
        Args: { p_pack_id: number; p_provider: string }
        Returns: Json
      }
      expire_generation_requests: { Args: never; Returns: number }
      fail_generation: { Args: { p_error: string; p_request_id: string }; Returns: Json }
      fixtures_with_prediction_flag: {
        Args: { p_fixture_ids: number[] }
        Returns: {
          fixture_id: number
          has_prediction: boolean
        }[]
      }
      get_fixture_predictions: { Args: { p_fixture_id: number }; Returns: Json }
      get_my_predictions: { Args: { p_limit?: number }; Returns: Json }
      get_my_wallet_summary: { Args: never; Returns: Json }
      get_performance_stats: { Args: never; Returns: Json }
      get_fixture_public_context: {
        Args: { p_fixture_id: number }
        Returns: Json
      }
      get_unlock_price: {
        Args: { p_fixture_id: number; p_market_code?: string }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      is_fixture_visible: { Args: { p_fixture_id: number }; Returns: boolean }
      is_valid_1x2_probabilities: { Args: { p: Json }; Returns: boolean }
      mark_notifications_read: { Args: { p_ids?: number[] }; Returns: number }
      refund_fixture: { Args: { p_fixture_id: number }; Returns: Json }
      save_ai_generation: {
        Args: {
          p_analysis: Json
          p_changed_by?: string
          p_fixture_id: number
          p_mode: string
          p_predictions: Json
          p_reason?: string
          p_run: Json
        }
        Returns: Json
      }
      settle_fixture: { Args: { p_fixture_id: number }; Returns: Json }
      settle_combo: {
        Args: { p_away: number; p_home: number; p_selection: string }
        Returns: Database["public"]["Enums"]["prediction_result"]
      }
      settle_outcome_full: {
        Args: {
          p_away: number
          p_cards: number
          p_corners: number
          p_home: number
          p_ht_away: number
          p_ht_home: number
          p_market: string
          p_selection: string
        }
        Returns: Database["public"]["Enums"]["prediction_result"]
      }
      settle_outcome_ht: {
        Args: {
          p_away: number
          p_home: number
          p_ht_away: number
          p_ht_home: number
          p_market: string
          p_selection: string
        }
        Returns: Database["public"]["Enums"]["prediction_result"]
      }
      start_generation: { Args: { p_request_id: string }; Returns: Json }
      start_topup: {
        Args: { p_pack_id: number; p_promo_code?: string; p_provider: string }
        Returns: Json
      }
      settle_outcome: {
        Args: {
          p_away: number
          p_home: number
          p_market: string
          p_selection: string
        }
        Returns: Database["public"]["Enums"]["prediction_result"]
      }
      unlock_prediction: {
        Args: { p_fixture_id: number; p_market_code?: string }
        Returns: Json
      }
    }
    Enums: {
      competition_category: "club_league" | "international"
      confidence_level: "low" | "medium" | "high"
      prediction_result: "pending" | "won" | "lost" | "void"
      prediction_status: "published" | "hidden"
      run_status: "running" | "success" | "partial" | "failed"
      topup_status: "pending" | "succeeded" | "failed" | "cancelled"
      transaction_type:
        | "topup"
        | "unlock"
        | "bonus"
        | "refund"
        | "admin_adjustment"
      user_role: "user" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      competition_category: ["club_league", "international"],
      confidence_level: ["low", "medium", "high"],
      prediction_result: ["pending", "won", "lost", "void"],
      prediction_status: ["published", "hidden"],
      run_status: ["running", "success", "partial", "failed"],
      topup_status: ["pending", "succeeded", "failed", "cancelled"],
      transaction_type: [
        "topup",
        "unlock",
        "bonus",
        "refund",
        "admin_adjustment",
      ],
      user_role: ["user", "admin"],
    },
  },
} as const
