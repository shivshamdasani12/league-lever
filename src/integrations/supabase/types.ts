export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
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
          token_amount: number
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
          accepted_at: string | null
          accepted_by: string | null
          code: string
          created_at: string
          email: string
          id: string
          invited_by: string
          league_id: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          code: string
          created_at?: string
          email: string
          id?: string
          invited_by: string
          league_id: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          code?: string
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          league_id?: string
          status?: string
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
      league_members: {
        Row: {
          id: string
          joined_at: string
          league_id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          league_id: string
          role?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          league_id?: string
          role?: string
          user_id?: string
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
          created_at: string
          created_by: string
          external_id: string | null
          id: string
          name: string
          provider: string | null
          scoring_settings: Json | null
          season: number | null
          settings_json: Json | null
          updated_at: string
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          created_by: string
          external_id?: string | null
          id?: string
          name: string
          provider?: string | null
          scoring_settings?: Json | null
          season?: number | null
          settings_json?: Json | null
          updated_at?: string
        }
        Update: {
          avatar?: string | null
          created_at?: string
          created_by?: string
          external_id?: string | null
          id?: string
          name?: string
          provider?: string | null
          scoring_settings?: Json | null
          season?: number | null
          settings_json?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          fantasy_positions: string[] | null
          full_name: string | null
          player_id: string
          position: string | null
          status: string | null
          team: string | null
          updated_at: string
        }
        Insert: {
          fantasy_positions?: string[] | null
          full_name?: string | null
          player_id: string
          position?: string | null
          status?: string | null
          team?: string | null
          updated_at?: string
        }
        Update: {
          fantasy_positions?: string[] | null
          full_name?: string | null
          player_id?: string
          position?: string | null
          status?: string | null
          team?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          token_balance: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          token_balance?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          token_balance?: number
          updated_at?: string
        }
        Relationships: []
      }
      sleeper_league_users: {
        Row: {
          app_user_id: string | null
          avatar: string | null
          display_name: string | null
          id: number
          is_commissioner: boolean | null
          league_id: string
          sleeper_user_id: string
          username: string | null
        }
        Insert: {
          app_user_id?: string | null
          avatar?: string | null
          display_name?: string | null
          id?: number
          is_commissioner?: boolean | null
          league_id: string
          sleeper_user_id: string
          username?: string | null
        }
        Update: {
          app_user_id?: string | null
          avatar?: string | null
          display_name?: string | null
          id?: number
          is_commissioner?: boolean | null
          league_id?: string
          sleeper_user_id?: string
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
          id: number
          is_consolation: boolean | null
          is_playoffs: boolean | null
          league_id: string
          matchup_id: number | null
          players: Json | null
          points: number | null
          roster_id: number
          starters: Json | null
          week: number
        }
        Insert: {
          id?: number
          is_consolation?: boolean | null
          is_playoffs?: boolean | null
          league_id: string
          matchup_id?: number | null
          players?: Json | null
          points?: number | null
          roster_id: number
          starters?: Json | null
          week: number
        }
        Update: {
          id?: number
          is_consolation?: boolean | null
          is_playoffs?: boolean | null
          league_id?: string
          matchup_id?: number | null
          players?: Json | null
          points?: number | null
          roster_id?: number
          starters?: Json | null
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
          id: number
          league_id: string
          owner_sleeper_user_id: string | null
          players: Json | null
          roster_id: number
          settings: Json | null
          starters: Json | null
        }
        Insert: {
          id?: number
          league_id: string
          owner_sleeper_user_id?: string | null
          players?: Json | null
          roster_id: number
          settings?: Json | null
          starters?: Json | null
        }
        Update: {
          id?: number
          league_id?: string
          owner_sleeper_user_id?: string | null
          players?: Json | null
          roster_id?: number
          settings?: Json | null
          starters?: Json | null
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
        Relationships: [
          {
            foreignKeyName: "transactions_bet_id_fkey"
            columns: ["bet_id"]
            isOneToOne: false
            referencedRelation: "bets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      league_matchup_pairs_v: {
        Row: {
          league_id: string | null
          matchup_id: number | null
          points_a: number | null
          points_b: number | null
          roster_a: number | null
          roster_b: number | null
          week: number | null
        }
        Relationships: []
      }
      league_matchups_v: {
        Row: {
          league_id: string | null
          opp_points: number | null
          opp_roster_id: number | null
          points: number | null
          roster_id: number | null
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
      league_players_v: {
        Row: {
          full_name: string | null
          league_id: string | null
          player_id: string | null
          position: string | null
          team: string | null
        }
        Relationships: []
      }
      league_rosters_named_v: {
        Row: {
          bench_named: Json | null
          league_id: string | null
          owner_avatar: string | null
          owner_name: string | null
          owner_username: string | null
          roster_id: number | null
          starters_named: Json | null
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
        Relationships: []
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
      accept_invite: {
        Args: { _invite_code: string }
        Returns: Json
      }
      is_league_creator: {
        Args: { _league_id: string; _user_id: string }
        Returns: boolean
      }
      is_league_member: {
        Args: { _league_id: string; _user_id: string }
        Returns: boolean
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
