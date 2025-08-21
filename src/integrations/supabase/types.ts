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
          created_at: string
          created_by: string
          id: string
          league_id: string
          outcome: string | null
          settled_at: string | null
          status: string
          terms: Json | null
          token_amount: number
          type: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by: string
          id?: string
          league_id: string
          outcome?: string | null
          settled_at?: string | null
          status?: string
          terms?: Json | null
          token_amount?: number
          type: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string
          id?: string
          league_id?: string
          outcome?: string | null
          settled_at?: string | null
          status?: string
          terms?: Json | null
          token_amount?: number
          type?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          code: string
          created_at: string
          email: string
          id: string
          invited_by: string
          league_id: string
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          id?: string
          invited_by: string
          league_id: string
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          league_id?: string
        }
        Relationships: []
      }
      league_members: {
        Row: {
          created_at: string | null
          id: string
          joined_at: string | null
          league_id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          joined_at?: string | null
          league_id: string
          role?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          joined_at?: string | null
          league_id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      leagues: {
        Row: {
          avatar: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          external_id: string | null
          id: string
          name: string
          provider: string | null
          scoring_settings: Json | null
          season: number | null
          settings_json: Json | null
          updated_at: string | null
        }
        Insert: {
          avatar?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          external_id?: string | null
          id?: string
          name: string
          provider?: string | null
          scoring_settings?: Json | null
          season?: number | null
          settings_json?: Json | null
          updated_at?: string | null
        }
        Update: {
          avatar?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          external_id?: string | null
          id?: string
          name?: string
          provider?: string | null
          scoring_settings?: Json | null
          season?: number | null
          settings_json?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      matchups: {
        Row: {
          created_at: string | null
          id: string
          league_id: string
          points_a: number | null
          points_b: number | null
          roster_a_id: string
          roster_b_id: string
          updated_at: string | null
          week: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          league_id: string
          points_a?: number | null
          points_b?: number | null
          roster_a_id: string
          roster_b_id: string
          updated_at?: string | null
          week: number
        }
        Update: {
          created_at?: string | null
          id?: string
          league_id?: string
          points_a?: number | null
          points_b?: number | null
          roster_a_id?: string
          roster_b_id?: string
          updated_at?: string | null
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "matchups_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      player_projections: {
        Row: {
          player_id: string
          points: number | null
          season: number
          updated_at: string | null
          week: number
        }
        Insert: {
          player_id: string
          points?: number | null
          season: number
          updated_at?: string | null
          week: number
        }
        Update: {
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
          id: string
          injury_status: string | null
          last_name: string | null
          name: string
          number: string | null
          per_game_stats: Json | null
          player_id: string | null
          position: string | null
          practice_participation: string | null
          search_rank: number | null
          search_rank_ppr: number | null
          sleeper_id: string | null
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
          id?: string
          injury_status?: string | null
          last_name?: string | null
          name: string
          number?: string | null
          per_game_stats?: Json | null
          player_id?: string | null
          position?: string | null
          practice_participation?: string | null
          search_rank?: number | null
          search_rank_ppr?: number | null
          sleeper_id?: string | null
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
          id?: string
          injury_status?: string | null
          last_name?: string | null
          name?: string
          number?: string | null
          per_game_stats?: Json | null
          player_id?: string | null
          position?: string | null
          practice_participation?: string | null
          search_rank?: number | null
          search_rank_ppr?: number | null
          sleeper_id?: string | null
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
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
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
      rosters: {
        Row: {
          created_at: string | null
          id: string
          league_id: string
          players: Json | null
          roster_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          league_id: string
          players?: Json | null
          roster_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          league_id?: string
          players?: Json | null
          roster_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rosters_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      sleeper_league_users: {
        Row: {
          avatar: string | null
          created_at: string | null
          display_name: string | null
          is_commissioner: boolean | null
          league_id: string
          sleeper_user_id: string
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar?: string | null
          created_at?: string | null
          display_name?: string | null
          is_commissioner?: boolean | null
          league_id: string
          sleeper_user_id: string
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar?: string | null
          created_at?: string | null
          display_name?: string | null
          is_commissioner?: boolean | null
          league_id?: string
          sleeper_user_id?: string
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      sleeper_matchups: {
        Row: {
          created_at: string | null
          league_id: string
          matchup_id: number | null
          players: Json | null
          points: number | null
          roster_id: number
          starters: Json | null
          updated_at: string | null
          week: number
        }
        Insert: {
          created_at?: string | null
          league_id: string
          matchup_id?: number | null
          players?: Json | null
          points?: number | null
          roster_id: number
          starters?: Json | null
          updated_at?: string | null
          week: number
        }
        Update: {
          created_at?: string | null
          league_id?: string
          matchup_id?: number | null
          players?: Json | null
          points?: number | null
          roster_id?: number
          starters?: Json | null
          updated_at?: string | null
          week?: number
        }
        Relationships: []
      }
      sleeper_rosters: {
        Row: {
          created_at: string | null
          league_id: string
          owner_sleeper_user_id: string | null
          players: Json | null
          roster_id: number
          settings: Json | null
          starters: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          league_id: string
          owner_sleeper_user_id?: string | null
          players?: Json | null
          roster_id: number
          settings?: Json | null
          starters?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          league_id?: string
          owner_sleeper_user_id?: string | null
          players?: Json | null
          roster_id?: number
          settings?: Json | null
          starters?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sleeper_standings: {
        Row: {
          created_at: string | null
          league_id: string
          losses: number | null
          owner_name: string | null
          points_against: number | null
          points_for: number | null
          rank: number | null
          roster_id: number
          season: number
          ties: number | null
          updated_at: string | null
          wins: number | null
        }
        Insert: {
          created_at?: string | null
          league_id: string
          losses?: number | null
          owner_name?: string | null
          points_against?: number | null
          points_for?: number | null
          rank?: number | null
          roster_id: number
          season: number
          ties?: number | null
          updated_at?: string | null
          wins?: number | null
        }
        Update: {
          created_at?: string | null
          league_id?: string
          losses?: number | null
          owner_name?: string | null
          points_against?: number | null
          points_for?: number | null
          rank?: number | null
          roster_id?: number
          season?: number
          ties?: number | null
          updated_at?: string | null
          wins?: number | null
        }
        Relationships: []
      }
      standings: {
        Row: {
          created_at: string | null
          id: string
          league_id: string
          losses: number | null
          points_against: number | null
          points_for: number | null
          roster_id: string
          ties: number | null
          updated_at: string | null
          wins: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          league_id: string
          losses?: number | null
          points_against?: number | null
          points_for?: number | null
          roster_id: string
          ties?: number | null
          updated_at?: string | null
          wins?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          league_id?: string
          losses?: number | null
          points_against?: number | null
          points_for?: number | null
          roster_id?: string
          ties?: number | null
          updated_at?: string | null
          wins?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "standings_league_id_fkey"
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
          bet_id: string | null
          created_at: string
          description: string | null
          id: string
          league_id: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          bet_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          league_id: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          bet_id?: string | null
          created_at?: string
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
        Relationships: []
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
          league_id: string | null
          owner_avatar: string | null
          owner_name: string | null
          owner_username: string | null
          players: Json | null
          roster_id: number | null
          starters: Json | null
        }
        Relationships: []
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
        Relationships: []
      }
      league_standings_v: {
        Row: {
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
        Insert: {
          league_id?: string | null
          losses?: number | null
          owner_name?: string | null
          pa?: number | null
          pf?: number | null
          roster_id?: number | null
          ties?: number | null
          win_pct?: never
          wins?: number | null
        }
        Update: {
          league_id?: string | null
          losses?: number | null
          owner_name?: string | null
          pa?: number | null
          pf?: number | null
          roster_id?: number | null
          ties?: number | null
          win_pct?: never
          wins?: number | null
        }
        Relationships: []
      }
      league_weeks_v: {
        Row: {
          is_latest: boolean | null
          league_id: string | null
          week: number | null
        }
        Relationships: []
      }
    }
    Functions: {
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
