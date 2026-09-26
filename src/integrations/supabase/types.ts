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
      agent_settings: {
        Row: {
          active: boolean
          frequency: number
          kill_switch: boolean
          language: string
          mode: string
          niche: string
          platforms: string[]
          time_slots: string[]
          tone: string
          updated_at: string
          user_id: string
          video_length: number
        }
        Insert: {
          active?: boolean
          frequency?: number
          kill_switch?: boolean
          language?: string
          mode?: string
          niche?: string
          platforms?: string[]
          time_slots?: string[]
          tone?: string
          updated_at?: string
          user_id: string
          video_length?: number
        }
        Update: {
          active?: boolean
          frequency?: number
          kill_switch?: boolean
          language?: string
          mode?: string
          niche?: string
          platforms?: string[]
          time_slots?: string[]
          tone?: string
          updated_at?: string
          user_id?: string
          video_length?: number
        }
        Relationships: []
      }
      app_config: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      approvals: {
        Row: {
          created_at: string
          decision: string
          id: string
          note: string | null
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          decision: string
          id?: string
          note?: string | null
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          note?: string | null
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      insights: {
        Row: {
          summary: string
          updated_at: string
          user_id: string
        }
        Insert: {
          summary?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          summary?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      post_metrics: {
        Row: {
          captured_at: string
          comments: number
          id: string
          likes: number
          post_id: string
          shares: number
          user_id: string
          views: number
        }
        Insert: {
          captured_at?: string
          comments?: number
          id?: string
          likes?: number
          post_id: string
          shares?: number
          user_id: string
          views?: number
        }
        Update: {
          captured_at?: string
          comments?: number
          id?: string
          likes?: number
          post_id?: string
          shares?: number
          user_id?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_metrics_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          attempts: number
          created_at: string
          error: string | null
          id: string
          permalink: string | null
          platform: string
          published_at: string | null
          remote_id: string | null
          scheduled_for: string | null
          status: string
          user_id: string
          video_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          permalink?: string | null
          platform: string
          published_at?: string | null
          remote_id?: string | null
          scheduled_for?: string | null
          status?: string
          user_id: string
          video_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          permalink?: string | null
          platform?: string
          published_at?: string | null
          remote_id?: string | null
          scheduled_for?: string | null
          status?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      social_accounts: {
        Row: {
          access_token: string | null
          created_at: string
          expires_at: string | null
          external_id: string | null
          handle: string | null
          id: string
          platform: string
          refresh_token: string | null
          status: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          external_id?: string | null
          handle?: string | null
          id?: string
          platform: string
          refresh_token?: string | null
          status?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          external_id?: string | null
          handle?: string | null
          id?: string
          platform?: string
          refresh_token?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      trends: {
        Row: {
          angle: string | null
          competitors: string | null
          created_at: string
          id: string
          rationale: string | null
          score: number
          source: string
          topic: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          angle?: string | null
          competitors?: string | null
          created_at?: string
          id?: string
          rationale?: string | null
          score?: number
          source?: string
          topic: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          angle?: string | null
          competitors?: string | null
          created_at?: string
          id?: string
          rationale?: string | null
          score?: number
          source?: string
          topic?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      videos: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          music_url: string | null
          scenes: Json
          script: string | null
          state: string
          storage_path: string | null
          title: string
          topic: string | null
          trend_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          music_url?: string | null
          scenes?: Json
          script?: string | null
          state?: string
          storage_path?: string | null
          title?: string
          topic?: string | null
          trend_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          music_url?: string | null
          scenes?: Json
          script?: string | null
          state?: string
          storage_path?: string | null
          title?: string
          topic?: string | null
          trend_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "videos_trend_id_fkey"
            columns: ["trend_id"]
            isOneToOne: false
            referencedRelation: "trends"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_user_bootstrap: { Args: never; Returns: undefined }
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
    Enums: {},
  },
} as const
