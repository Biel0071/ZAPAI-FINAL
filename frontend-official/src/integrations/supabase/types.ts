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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_accounts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          password_hash: string
          role: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          password_hash: string
          role?: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          password_hash?: string
          role?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      ai_learning_logs: {
        Row: {
          applied_at: string | null
          company_id: string
          conversation_id: string
          created_at: string
          drop_off_moment: string | null
          frequent_question: string | null
          id: string
          issue_type: string
          metadata: Json
          problem_detected: string
          source_run_date: string
          status: string
          suggested_improvement: string | null
          suggested_new_flow: string | null
          suggested_prompt_improvement: string | null
          suggested_response: string | null
        }
        Insert: {
          applied_at?: string | null
          company_id?: string
          conversation_id: string
          created_at?: string
          drop_off_moment?: string | null
          frequent_question?: string | null
          id?: string
          issue_type: string
          metadata?: Json
          problem_detected: string
          source_run_date?: string
          status?: string
          suggested_improvement?: string | null
          suggested_new_flow?: string | null
          suggested_prompt_improvement?: string | null
          suggested_response?: string | null
        }
        Update: {
          applied_at?: string | null
          company_id?: string
          conversation_id?: string
          created_at?: string
          drop_off_moment?: string | null
          frequent_question?: string | null
          id?: string
          issue_type?: string
          metadata?: Json
          problem_detected?: string
          source_run_date?: string
          status?: string
          suggested_improvement?: string | null
          suggested_new_flow?: string | null
          suggested_prompt_improvement?: string | null
          suggested_response?: string | null
        }
        Relationships: []
      }
      ai_learning_runs: {
        Row: {
          company_id: string
          conversion_rate: number
          created_at: string
          drop_off_points: number
          failed_conversations: number
          frequent_questions: number
          id: string
          lost_leads: number
          missing_responses: number
          prompt_improvements_applied: number
          run_date: string
          total_conversations_analyzed: number
          updated_at: string
        }
        Insert: {
          company_id?: string
          conversion_rate?: number
          created_at?: string
          drop_off_points?: number
          failed_conversations?: number
          frequent_questions?: number
          id?: string
          lost_leads?: number
          missing_responses?: number
          prompt_improvements_applied?: number
          run_date?: string
          total_conversations_analyzed?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          conversion_rate?: number
          created_at?: string
          drop_off_points?: number
          failed_conversations?: number
          frequent_questions?: number
          id?: string
          lost_leads?: number
          missing_responses?: number
          prompt_improvements_applied?: number
          run_date?: string
          total_conversations_analyzed?: number
          updated_at?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
          phone: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
          phone: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          phone?: string
        }
        Relationships: []
      }
      conversation_controls: {
        Row: {
          ai_enabled: boolean
          company_id: string
          conversation_id: string
          created_at: string
          summarized_message_count: number
          summary: string | null
          updated_at: string
        }
        Insert: {
          ai_enabled?: boolean
          company_id?: string
          conversation_id: string
          created_at?: string
          summarized_message_count?: number
          summary?: string | null
          updated_at?: string
        }
        Update: {
          ai_enabled?: boolean
          company_id?: string
          conversation_id?: string
          created_at?: string
          summarized_message_count?: number
          summary?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      conversation_insights: {
        Row: {
          company_id: string
          conversation_id: string
          created_at: string
          customer_interest_score: number | null
          id: string
          objections: Json
          purchase_signals: Json
          questions: Json
          recommended_action: string | null
          summary: string | null
        }
        Insert: {
          company_id?: string
          conversation_id: string
          created_at?: string
          customer_interest_score?: number | null
          id?: string
          objections?: Json
          purchase_signals?: Json
          questions?: Json
          recommended_action?: string | null
          summary?: string | null
        }
        Update: {
          company_id?: string
          conversation_id?: string
          created_at?: string
          customer_interest_score?: number | null
          id?: string
          objections?: Json
          purchase_signals?: Json
          questions?: Json
          recommended_action?: string | null
          summary?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          ai_enabled: boolean
          company_id: string
          contact_id: string
          created_at: string
          id: string
          last_message: string | null
          lead_temperature: string
          session_id: string | null
          status: string
          summary: string | null
          unread_count: number
          updated_at: string
        }
        Insert: {
          ai_enabled?: boolean
          company_id: string
          contact_id: string
          created_at?: string
          id?: string
          last_message?: string | null
          lead_temperature?: string
          session_id?: string | null
          status?: string
          summary?: string | null
          unread_count?: number
          updated_at?: string
        }
        Update: {
          ai_enabled?: boolean
          company_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          last_message?: string | null
          lead_temperature?: string
          session_id?: string | null
          status?: string
          summary?: string | null
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_intelligence: {
        Row: {
          company_id: string
          confidence: number
          conversation_id: string
          created_at: string
          id: string
          intent: string
          lead_temperature: string
          next_action: string
          updated_at: string
        }
        Insert: {
          company_id?: string
          confidence?: number
          conversation_id: string
          created_at?: string
          id?: string
          intent: string
          lead_temperature: string
          next_action: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          confidence?: number
          conversation_id?: string
          created_at?: string
          id?: string
          intent?: string
          lead_temperature?: string
          next_action?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          company_id: string
          content: string
          conversation_id: string
          emoji: string | null
          id: string
          media_path: string | null
          media_url: string | null
          sender: string
          status: string
          timestamp: string
          type: string
        }
        Insert: {
          company_id?: string
          content?: string
          conversation_id: string
          emoji?: string | null
          id?: string
          media_path?: string | null
          media_url?: string | null
          sender: string
          status?: string
          timestamp?: string
          type?: string
        }
        Update: {
          company_id?: string
          content?: string
          conversation_id?: string
          emoji?: string | null
          id?: string
          media_path?: string | null
          media_url?: string | null
          sender?: string
          status?: string
          timestamp?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_history: {
        Row: {
          applied_from_log_id: string | null
          company_id: string
          created_at: string
          id: string
          prompt_content: string
          version_label: string | null
        }
        Insert: {
          applied_from_log_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          prompt_content: string
          version_label?: string | null
        }
        Update: {
          applied_from_log_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          prompt_content?: string
          version_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_history_applied_from_log_id_fkey"
            columns: ["applied_from_log_id"]
            isOneToOne: false
            referencedRelation: "ai_learning_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          company_id: string
          created_at: string
          id: string
          phone_number: string | null
          session_name: string
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          phone_number?: string | null
          session_name: string
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          phone_number?: string | null
          session_name?: string
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_company_id: { Args: never; Returns: string }
      verify_admin_credentials: {
        Args: { _password: string; _username: string }
        Returns: Json
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
