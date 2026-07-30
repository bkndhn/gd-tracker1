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
      ai_usage_log: {
        Row: {
          admin_id: string
          context: string | null
          created_at: string
          id: string
          mode: string | null
          user_id: string
        }
        Insert: {
          admin_id: string
          context?: string | null
          created_at?: string
          id?: string
          mode?: string | null
          user_id: string
        }
        Update: {
          admin_id?: string
          context?: string | null
          created_at?: string
          id?: string
          mode?: string | null
          user_id?: string
        }
        Relationships: []
      }
      app_sessions: {
        Row: {
          admin_id: string | null
          crashed: boolean
          created_at: string
          duration_ms: number
          environment: string
          errored: boolean
          id: string
          last_seen_at: string
          release: string
          session_id: string
          started_at: string
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          admin_id?: string | null
          crashed?: boolean
          created_at?: string
          duration_ms?: number
          environment?: string
          errored?: boolean
          id?: string
          last_seen_at?: string
          release?: string
          session_id: string
          started_at?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          admin_id?: string | null
          crashed?: boolean
          created_at?: string
          duration_ms?: number
          environment?: string
          errored?: boolean
          id?: string
          last_seen_at?: string
          release?: string
          session_id?: string
          started_at?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          admin_id: string | null
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          admin_id?: string | null
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value?: Json
        }
        Update: {
          admin_id?: string | null
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      backup_logs: {
        Row: {
          created_at: string
          drive_file_id: string | null
          drive_web_link: string | null
          error_message: string | null
          filename: string | null
          id: string
          size_bytes: number | null
          status: string
          took_ms: number | null
          trigger_source: string
        }
        Insert: {
          created_at?: string
          drive_file_id?: string | null
          drive_web_link?: string | null
          error_message?: string | null
          filename?: string | null
          id?: string
          size_bytes?: number | null
          status?: string
          took_ms?: number | null
          trigger_source?: string
        }
        Update: {
          created_at?: string
          drive_file_id?: string | null
          drive_web_link?: string | null
          error_message?: string | null
          filename?: string | null
          id?: string
          size_bytes?: number | null
          status?: string
          took_ms?: number | null
          trigger_source?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          admin_id: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          admin_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          admin_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      client_errors: {
        Row: {
          admin_id: string | null
          breadcrumbs: Json
          component_stack: string | null
          created_at: string
          environment: string
          fingerprint: string
          id: string
          kind: string
          level: string
          message: string
          release: string
          session_id: string | null
          stack: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          admin_id?: string | null
          breadcrumbs?: Json
          component_stack?: string | null
          created_at?: string
          environment?: string
          fingerprint?: string
          id?: string
          kind?: string
          level?: string
          message: string
          release?: string
          session_id?: string | null
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          admin_id?: string | null
          breadcrumbs?: Json
          component_stack?: string | null
          created_at?: string
          environment?: string
          fingerprint?: string
          id?: string
          kind?: string
          level?: string
          message?: string
          release?: string
          session_id?: string | null
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      custom_field_options: {
        Row: {
          created_at: string | null
          custom_field_id: string | null
          deleted_at: string | null
          display_order: number | null
          id: string
          legacy_id: string | null
          legacy_table: string | null
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          custom_field_id?: string | null
          deleted_at?: string | null
          display_order?: number | null
          id?: string
          legacy_id?: string | null
          legacy_table?: string | null
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          custom_field_id?: string | null
          deleted_at?: string | null
          display_order?: number | null
          id?: string
          legacy_id?: string | null
          legacy_table?: string | null
          updated_at?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_options_custom_field_id_fkey"
            columns: ["custom_field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_fields: {
        Row: {
          admin_id: string
          created_at: string | null
          deleted_at: string | null
          display_order: number | null
          field_type: string
          id: string
          is_mandatory: boolean | null
          is_standard: boolean
          is_visible: boolean | null
          name: string
          standard_key: string | null
          updated_at: string | null
        }
        Insert: {
          admin_id: string
          created_at?: string | null
          deleted_at?: string | null
          display_order?: number | null
          field_type?: string
          id?: string
          is_mandatory?: boolean | null
          is_standard?: boolean
          is_visible?: boolean | null
          name: string
          standard_key?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_id?: string
          created_at?: string | null
          deleted_at?: string | null
          display_order?: number | null
          field_type?: string
          id?: string
          is_mandatory?: boolean | null
          is_standard?: boolean
          is_visible?: boolean | null
          name?: string
          standard_key?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      customer_types: {
        Row: {
          admin_id: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          admin_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          admin_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      gd_entry_custom_values: {
        Row: {
          created_at: string | null
          custom_field_id: string | null
          custom_field_option_id: string | null
          gd_entry_id: string | null
          id: string
          value: string | null
        }
        Insert: {
          created_at?: string | null
          custom_field_id?: string | null
          custom_field_option_id?: string | null
          gd_entry_id?: string | null
          id?: string
          value?: string | null
        }
        Update: {
          created_at?: string | null
          custom_field_id?: string | null
          custom_field_option_id?: string | null
          gd_entry_id?: string | null
          id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gd_entry_custom_values_custom_field_id_fkey"
            columns: ["custom_field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gd_entry_custom_values_custom_field_option_id_fkey"
            columns: ["custom_field_option_id"]
            isOneToOne: false
            referencedRelation: "custom_field_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gd_entry_custom_values_gd_entry_id_fkey"
            columns: ["gd_entry_id"]
            isOneToOne: false
            referencedRelation: "goods_damaged_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      gd_entry_images: {
        Row: {
          created_at: string | null
          file_size: number | null
          gd_entry_id: string | null
          id: string
          image_name: string | null
          image_url: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          file_size?: number | null
          gd_entry_id?: string | null
          id?: string
          image_name?: string | null
          image_url: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          file_size?: number | null
          gd_entry_id?: string | null
          id?: string
          image_name?: string | null
          image_url?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gd_entry_images_gd_entry_id_fkey"
            columns: ["gd_entry_id"]
            isOneToOne: false
            referencedRelation: "goods_damaged_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_damaged_entries: {
        Row: {
          admin_id: string | null
          category_id: string | null
          created_at: string | null
          customer_type_id: string | null
          employee_id: string | null
          employee_name: string | null
          id: string
          notes: string
          shop_id: string | null
          size_id: string | null
          updated_at: string | null
          voice_note_url: string | null
        }
        Insert: {
          admin_id?: string | null
          category_id?: string | null
          created_at?: string | null
          customer_type_id?: string | null
          employee_id?: string | null
          employee_name?: string | null
          id?: string
          notes: string
          shop_id?: string | null
          size_id?: string | null
          updated_at?: string | null
          voice_note_url?: string | null
        }
        Update: {
          admin_id?: string | null
          category_id?: string | null
          created_at?: string | null
          customer_type_id?: string | null
          employee_id?: string | null
          employee_name?: string | null
          id?: string
          notes?: string
          shop_id?: string | null
          size_id?: string | null
          updated_at?: string | null
          voice_note_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goods_damaged_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_damaged_entries_customer_type_id_fkey"
            columns: ["customer_type_id"]
            isOneToOne: false
            referencedRelation: "customer_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_damaged_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_damaged_entries_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_damaged_entries_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "sizes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          admin_id: string | null
          ai_daily_limit: number | null
          ai_enabled: boolean
          ai_lifetime_limit: number | null
          ai_monthly_limit: number | null
          created_at: string | null
          default_category_id: string | null
          default_size_id: string | null
          deleted_at: string | null
          email: string | null
          id: string
          max_entries: number | null
          max_images_per_entry: number | null
          max_images_total: number | null
          max_shops: number | null
          max_users: number | null
          name: string
          role: string
          shop_id: string | null
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          admin_id?: string | null
          ai_daily_limit?: number | null
          ai_enabled?: boolean
          ai_lifetime_limit?: number | null
          ai_monthly_limit?: number | null
          created_at?: string | null
          default_category_id?: string | null
          default_size_id?: string | null
          deleted_at?: string | null
          email?: string | null
          id: string
          max_entries?: number | null
          max_images_per_entry?: number | null
          max_images_total?: number | null
          max_shops?: number | null
          max_users?: number | null
          name: string
          role?: string
          shop_id?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          admin_id?: string | null
          ai_daily_limit?: number | null
          ai_enabled?: boolean
          ai_lifetime_limit?: number | null
          ai_monthly_limit?: number | null
          created_at?: string | null
          default_category_id?: string | null
          default_size_id?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          max_entries?: number | null
          max_images_per_entry?: number | null
          max_images_total?: number | null
          max_shops?: number | null
          max_users?: number | null
          name?: string
          role?: string
          shop_id?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_email_reports: {
        Row: {
          admin_id: string
          created_at: string
          deleted_at: string | null
          frequency: string
          id: string
          is_enabled: boolean
          last_sent_at: string | null
          recipient_email: string
          report_time: string
          timezone: string
          updated_at: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          deleted_at?: string | null
          frequency?: string
          id?: string
          is_enabled?: boolean
          last_sent_at?: string | null
          recipient_email: string
          report_time?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          deleted_at?: string | null
          frequency?: string
          id?: string
          is_enabled?: boolean
          last_sent_at?: string | null
          recipient_email?: string
          report_time?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      shops: {
        Row: {
          admin_id: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          name: string
          updated_at: string | null
          whatsapp_group_link: string | null
        }
        Insert: {
          admin_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
          whatsapp_group_link?: string | null
        }
        Update: {
          admin_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          whatsapp_group_link?: string | null
        }
        Relationships: []
      }
      sizes: {
        Row: {
          admin_id: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          size: string
          updated_at: string | null
        }
        Insert: {
          admin_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          size: string
          updated_at?: string | null
        }
        Update: {
          admin_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          size?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_gd_storage_path: {
        Args: { _bucket_id: string; _object_name: string }
        Returns: boolean
      }
      ensure_current_profile: {
        Args: never
        Returns: {
          admin_id: string | null
          ai_daily_limit: number | null
          ai_enabled: boolean
          ai_lifetime_limit: number | null
          ai_monthly_limit: number | null
          created_at: string | null
          default_category_id: string | null
          default_size_id: string | null
          deleted_at: string | null
          email: string | null
          id: string
          max_entries: number | null
          max_images_per_entry: number | null
          max_images_total: number | null
          max_shops: number | null
          max_users: number | null
          name: string
          role: string
          shop_id: string | null
          status: string
          updated_at: string | null
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_user_admin_id_secure: { Args: { user_uuid: string }; Returns: string }
      get_user_role_secure: { Args: { user_uuid: string }; Returns: string }
      get_user_shop_id_secure: { Args: { user_uuid: string }; Returns: string }
      is_super_admin: { Args: { user_uuid: string }; Returns: boolean }
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
