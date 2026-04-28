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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string | null
          email: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          email: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          email?: string
          user_id?: string
        }
        Relationships: []
      }
      games: {
        Row: {
          created_at: string
          slug: string
          state: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          slug: string
          state?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          slug?: string
          state?: Json
          updated_at?: string
        }
        Relationships: []
      }
      player_portraits: {
        Row: {
          created_at: string
          email: string
          name: string | null
          portrait_path: string | null
          portrait_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          name?: string | null
          portrait_path?: string | null
          portrait_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          name?: string | null
          portrait_path?: string | null
          portrait_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      score_adjustments: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_label: string | null
          id: string
          player_id: string
          points: number
          reason: string
          season_id: string
          week_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_label?: string | null
          id?: string
          player_id: string
          points: number
          reason: string
          season_id: string
          week_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_label?: string | null
          id?: string
          player_id?: string
          points?: number
          reason?: string
          season_id?: string
          week_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "score_adjustments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["season_id"]
          },
        ]
      }
      season_states: {
        Row: {
          created_at: string
          season_id: string
          state: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          season_id: string
          state?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          season_id?: string
          state?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_states_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: true
            referencedRelation: "seasons"
            referencedColumns: ["season_id"]
          },
        ]
      }
      seasons: {
        Row: {
          active_week_id: string | null
          created_at: string
          finale_config: Json | null
          label: string
          lock_schedule: Json
          rule_pack_id: string | null
          season_id: string
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          active_week_id?: string | null
          created_at?: string
          finale_config?: Json | null
          label: string
          lock_schedule?: Json
          rule_pack_id?: string | null
          season_id: string
          status: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          active_week_id?: string | null
          created_at?: string
          finale_config?: Json | null
          label?: string
          lock_schedule?: Json
          rule_pack_id?: string | null
          season_id?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      show_configs: {
        Row: {
          config: Json
          created_at: string
          slug: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          slug: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          created_at: string
          email: string
          id: string
          kind: string
          league: string | null
          name: string
          payload: Json
          rule_pack_id: string | null
          season_id: string | null
          submission_status: string
          updated_at: string
          week_id: string | null
          weekly_banished: string | null
          weekly_murdered: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          kind: string
          league?: string | null
          name: string
          payload?: Json
          rule_pack_id?: string | null
          season_id?: string | null
          submission_status?: string
          updated_at?: string
          week_id?: string | null
          weekly_banished?: string | null
          weekly_murdered?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          kind?: string
          league?: string | null
          name?: string
          payload?: Json
          rule_pack_id?: string | null
          season_id?: string | null
          submission_status?: string
          updated_at?: string
          week_id?: string | null
          weekly_banished?: string | null
          weekly_murdered?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_traitors_admin: { Args: never; Returns: boolean }
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
