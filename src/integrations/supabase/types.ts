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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      bets: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string | null
          created_by: string | null
          id: string
          league_id: string | null
          outcome: string | null
          season: number | null
          settled_at: string | null
          status: string
          terms: Json | null
          token_amount: number
          type: string
          updated_at: string | null
          week: number | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          league_id?: string | null
          outcome?: string | null
          season?: number | null
          settled_at?: string | null
          status?: string
          terms?: Json | null
          token_amount?: number
          type: string
          updated_at?: string | null
          week?: number | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          league_id?: string | null
          outcome?: string | null
          season?: number | null
          settled_at?: string | null
          status?: string
          terms?: Json | null
          token_amount?: number
          type?: string
          updated_at?: string | null
          week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bets_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string | null
          expires_at: string | null
          id: string
          league_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          league_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          league_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      job_locks: {
        Row: {
          created_at: string | null
          job: string
          locked_at: string
          locked_until: string | null
        }
        Insert: {
          created_at?: string | null
          job: string
          locked_at?: string
          locked_until?: string | null
        }
        Update: {
          created_at?: string | null
          job?: string
          locked_at?: string
          locked_until?: string | null
        }
        Relationships: []
      }
      league_members: {
        Row: {
          created_at: string | null
          id: string
          joined_at: string | null
          league_id: string | null
          role: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          joined_at?: string | null
          league_id?: string | null
          role?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          joined_at?: string | null
          league_id?: string | null
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          avatar: string | null
          created_at: string | null
          created_by: string | null
          external_id: string
          id: string
          name: string
          provider: string
          scoring_settings: Json | null
          season: number | null
          settings_json: Json | null
          updated_at: string | null
        }
        Insert: {
          avatar?: string | null
          created_at?: string | null
          created_by?: string | null
          external_id: string
          id?: string
          name: string
          provider: string
          scoring_settings?: Json | null
          season?: number | null
          settings_json?: Json | null
          updated_at?: string | null
        }
        Update: {
          avatar?: string | null
          created_at?: string | null
          created_by?: string | null
          external_id?: string
          id?: string
          name?: string
          provider?: string
          scoring_settings?: Json | null
          season?: number | null
          settings_json?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      player_projections: {
        Row: {
          created_at: string | null
          id: string
          player_id: string
          points: number | null
          season: number
          updated_at: string | null
          week: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          player_id: string
          points?: number | null
          season: number
          updated_at?: string | null
          week: number
        }
        Update: {
          created_at?: string | null
          id?: string
          player_id?: string
          points?: number | null
          season?: number
          updated_at?: string | null
          week?: number
        }
        Relationships: []
      }
      players: {
        Row: {
          age: number | null
          college: string | null
          created_at: string | null
          current_week_projection: number | null
          current_week_stats: Json | null
          experience: string | null
          fantasy_positions: string[] | null
          first_name: string | null
          full_name: string | null
          hashtag: string | null
          height: string | null
          injury_status: string | null
          last_name: string | null
          number: string | null
          per_game_stats: Json | null
          player_id: string
          position: string | null
          practice_participation: string | null
          search_rank: number | null
          search_rank_ppr: number | null
          sport: string | null
          status: string | null
          team: string | null
          updated_at: string | null
          weight: string | null
        }
        Insert: {
          age?: number | null
          college?: string | null
          created_at?: string | null
          current_week_projection?: number | null
          current_week_stats?: Json | null
          experience?: string | null
          fantasy_positions?: string[] | null
          first_name?: string | null
          full_name?: string | null
          hashtag?: string | null
          height?: string | null
          injury_status?: string | null
          last_name?: string | null
          number?: string | null
          per_game_stats?: Json | null
          player_id: string
          position?: string | null
          practice_participation?: string | null
          search_rank?: number | null
          search_rank_ppr?: number | null
          sport?: string | null
          status?: string | null
          team?: string | null
          updated_at?: string | null
          weight?: string | null
        }
        Update: {
          age?: number | null
          college?: string | null
          created_at?: string | null
          current_week_projection?: number | null
          current_week_stats?: Json | null
          experience?: string | null
          fantasy_positions?: string[] | null
          first_name?: string | null
          full_name?: string | null
          hashtag?: string | null
          height?: string | null
          injury_status?: string | null
          last_name?: string | null
          number?: string | null
          per_game_stats?: Json | null
          player_id?: string
          position?: string | null
          practice_participation?: string | null
          search_rank?: number | null
          search_rank_ppr?: number | null
          sport?: string | null
          status?: string | null
          team?: string | null
          updated_at?: string | null
          weight?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          token_balance: number | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          token_balance?: number | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          token_balance?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      projections: {
        Row: {
          created_at: string | null
          id: string
          player_id: string
          points: number | null
          position: string | null
          raw: Json | null
          scoring: string
          season: number
          source: string
          updated_at: string | null
          week: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          player_id: string
          points?: number | null
          position?: string | null
          raw?: Json | null
          scoring?: string
          season: number
          source: string
          updated_at?: string | null
          week: number
        }
        Update: {
          created_at?: string | null
          id?: string
          player_id?: string
          points?: number | null
          position?: string | null
          raw?: Json | null
          scoring?: string
          season?: number
          source?: string
          updated_at?: string | null
          week?: number
        }
        Relationships: []
      }
      sleeper_league_users: {
        Row: {
          app_user_id: string | null
          avatar: string | null
          created_at: string | null
          display_name: string | null
          id: string
          is_commissioner: boolean | null
          league_id: string | null
          metadata: Json | null
          sleeper_user_id: string
          updated_at: string | null
          username: string | null
        }
        Insert: {
          app_user_id?: string | null
          avatar?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_commissioner?: boolean | null
          league_id?: string | null
          metadata?: Json | null
          sleeper_user_id: string
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          app_user_id?: string | null
          avatar?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_commissioner?: boolean | null
          league_id?: string | null
          metadata?: Json | null
          sleeper_user_id?: string
          updated_at?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sleeper_league_users_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      sleeper_matchups: {
        Row: {
          created_at: string | null
          id: string
          league_id: string | null
          matchup_id: number | null
          metadata: Json | null
          players: Json | null
          points: number | null
          roster_id: number
          starters: Json | null
          updated_at: string | null
          week: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          league_id?: string | null
          matchup_id?: number | null
          metadata?: Json | null
          players?: Json | null
          points?: number | null
          roster_id: number
          starters?: Json | null
          updated_at?: string | null
          week: number
        }
        Update: {
          created_at?: string | null
          id?: string
          league_id?: string | null
          matchup_id?: number | null
          metadata?: Json | null
          players?: Json | null
          points?: number | null
          roster_id?: number
          starters?: Json | null
          updated_at?: string | null
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "sleeper_matchups_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      sleeper_rosters: {
        Row: {
          created_at: string | null
          id: string
          league_id: string | null
          metadata: Json | null
          owner_sleeper_user_id: string | null
          players: Json | null
          roster_id: number
          settings: Json | null
          starters: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          league_id?: string | null
          metadata?: Json | null
          owner_sleeper_user_id?: string | null
          players?: Json | null
          roster_id: number
          settings?: Json | null
          starters?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          league_id?: string | null
          metadata?: Json | null
          owner_sleeper_user_id?: string | null
          players?: Json | null
          roster_id?: number
          settings?: Json | null
          starters?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sleeper_rosters_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          bet_id: string
          created_at: string | null
          description: string | null
          id: string
          league_id: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          bet_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          league_id: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          bet_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          league_id?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      league_matchups_v: {
        Row: {
          league_id: string | null
          matchup_id: number | null
          points_a: number | null
          points_b: number | null
          roster_id_a: number | null
          roster_id_b: number | null
          week: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sleeper_matchups_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_player_ids_v: {
        Row: {
          league_id: string | null
          player_id: string | null
        }
        Relationships: []
      }
      league_rosters_named_v: {
        Row: {
          is_commissioner: boolean | null
          league_id: string | null
          owner_avatar: string | null
          owner_name: string | null
          owner_sleeper_user_id: string | null
          owner_username: string | null
          players: Json | null
          roster_id: number | null
          settings: Json | null
          starters: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "sleeper_rosters_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_rosters_v: {
        Row: {
          league_id: string | null
          owner_avatar: string | null
          owner_name: string | null
          owner_username: string | null
          players: Json | null
          roster_id: number | null
          starters: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "sleeper_rosters_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_standings_v: {
        Row: {
          avatar: string | null
          display_name: string | null
          league_id: string | null
          losses: number | null
          owner_name: string | null
          pa: number | null
          pf: number | null
          roster_id: number | null
          ties: number | null
          win_pct: number | null
          wins: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sleeper_rosters_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_weeks_v: {
        Row: {
          is_latest: boolean | null
          league_id: string | null
          week: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sleeper_matchups_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_updated_at_trigger: {
        Args: { _table: unknown }
        Returns: undefined
      }
      get_league_projections: {
        Args: {
          in_league_player_ids: string[]
          in_season: number
          in_week: number
        }
        Returns: {
          player_id: string
          points: number
          updated_at: string
        }[]
      }
      increment_token_balance: {
        Args: { amount: number; user_id: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
