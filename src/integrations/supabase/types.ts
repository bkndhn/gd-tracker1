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
      anomaly_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          actual_count: number
          admin_id: string
          created_at: string
          expected_count: number
          fingerprint: string
          id: string
          metric: string
          reason_label: string | null
          severity: string
          shop_id: string | null
          shop_name: string | null
          updated_at: string
          window_end: string
          window_start: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          actual_count?: number
          admin_id: string
          created_at?: string
          expected_count?: number
          fingerprint: string
          id?: string
          metric?: string
          reason_label?: string | null
          severity?: string
          shop_id?: string | null
          shop_name?: string | null
          updated_at?: string
          window_end: string
          window_start: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          actual_count?: number
          admin_id?: string
          created_at?: string
          expected_count?: number
          fingerprint?: string
          id?: string
          metric?: string
          reason_label?: string | null
          severity?: string
          shop_id?: string | null
          shop_name?: string | null
          updated_at?: string
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "anomaly_alerts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
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
      changelog: {
        Row: {
          body: string
          created_at: string
          id: string
          title: string
          version: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          title: string
          version?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          title?: string
          version?: string | null
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
          scope: string
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
          scope?: string
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
          scope?: string
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
      entry_evidence: {
        Row: {
          admin_id: string
          caption: string | null
          created_at: string
          entry_id: string
          file_name: string
          file_size: number
          id: string
          mime_type: string
          storage_path: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          admin_id: string
          caption?: string | null
          created_at?: string
          entry_id: string
          file_name: string
          file_size?: number
          id?: string
          mime_type: string
          storage_path: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          admin_id?: string
          caption?: string | null
          created_at?: string
          entry_id?: string
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_evidence_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "goods_damaged_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_ups: {
        Row: {
          admin_id: string
          channel: string
          created_at: string
          customer_name: string | null
          delivered_at: string | null
          delivery_error: string | null
          delivery_status: string
          entry_id: string | null
          id: string
          message: string | null
          next_reminder_at: string | null
          outcome: string
          outcome_at: string | null
          outcome_note: string | null
          phone: string
          read_at: string | null
          reason_label: string | null
          recovered_amount: number
          reminder_stage: number
          sent_at: string
          sent_by: string
          sent_by_name: string | null
          shop_id: string | null
          shop_name: string | null
          template_key: string | null
          updated_at: string
          wa_message_id: string | null
        }
        Insert: {
          admin_id: string
          channel?: string
          created_at?: string
          customer_name?: string | null
          delivered_at?: string | null
          delivery_error?: string | null
          delivery_status?: string
          entry_id?: string | null
          id?: string
          message?: string | null
          next_reminder_at?: string | null
          outcome?: string
          outcome_at?: string | null
          outcome_note?: string | null
          phone: string
          read_at?: string | null
          reason_label?: string | null
          recovered_amount?: number
          reminder_stage?: number
          sent_at?: string
          sent_by: string
          sent_by_name?: string | null
          shop_id?: string | null
          shop_name?: string | null
          template_key?: string | null
          updated_at?: string
          wa_message_id?: string | null
        }
        Update: {
          admin_id?: string
          channel?: string
          created_at?: string
          customer_name?: string | null
          delivered_at?: string | null
          delivery_error?: string | null
          delivery_status?: string
          entry_id?: string | null
          id?: string
          message?: string | null
          next_reminder_at?: string | null
          outcome?: string
          outcome_at?: string | null
          outcome_note?: string | null
          phone?: string
          read_at?: string | null
          reason_label?: string | null
          recovered_amount?: number
          reminder_stage?: number
          sent_at?: string
          sent_by?: string
          sent_by_name?: string | null
          shop_id?: string | null
          shop_name?: string | null
          template_key?: string | null
          updated_at?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "goods_damaged_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      gd_entry_custom_values: {
        Row: {
          created_at: string | null
          custom_field_id: string | null
          custom_field_option_id: string | null
          gd_entry_id: string | null
          id: string
          requirement_id: string | null
          value: string | null
        }
        Insert: {
          created_at?: string | null
          custom_field_id?: string | null
          custom_field_option_id?: string | null
          gd_entry_id?: string | null
          id?: string
          requirement_id?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string | null
          custom_field_id?: string | null
          custom_field_option_id?: string | null
          gd_entry_id?: string | null
          id?: string
          requirement_id?: string | null
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
          {
            foreignKeyName: "gd_entry_custom_values_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "stock_requirements"
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
          max_requirements_monthly: number | null
          max_shops: number | null
          max_users: number | null
          max_warehouse_users: number | null
          name: string
          requirements_enabled: boolean
          role: string
          shop_id: string | null
          status: string
          updated_at: string | null
          user_id: string | null
          warehouse_all_shops: boolean
          warehouse_shop_ids: string[]
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
          max_requirements_monthly?: number | null
          max_shops?: number | null
          max_users?: number | null
          max_warehouse_users?: number | null
          name: string
          requirements_enabled?: boolean
          role?: string
          shop_id?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
          warehouse_all_shops?: boolean
          warehouse_shop_ids?: string[]
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
          max_requirements_monthly?: number | null
          max_shops?: number | null
          max_users?: number | null
          max_warehouse_users?: number | null
          name?: string
          requirements_enabled?: boolean
          role?: string
          shop_id?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
          warehouse_all_shops?: boolean
          warehouse_shop_ids?: string[]
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
      saved_views: {
        Row: {
          admin_id: string
          created_at: string
          deleted_at: string | null
          filters: Json
          id: string
          is_default: boolean
          name: string
          owner_id: string
          page: string
          scope: string
          shop_id: string | null
          updated_at: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          deleted_at?: string | null
          filters?: Json
          id?: string
          is_default?: boolean
          name: string
          owner_id: string
          page: string
          scope?: string
          shop_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          deleted_at?: string | null
          filters?: Json
          id?: string
          is_default?: boolean
          name?: string
          owner_id?: string
          page?: string
          scope?: string
          shop_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_views_shop_id_fkey"
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
      settings_audit_log: {
        Row: {
          admin_id: string
          changed_by: string
          changed_by_name: string | null
          created_at: string
          id: string
          new_value: Json
          note: string | null
          old_value: Json | null
          setting_key: string
        }
        Insert: {
          admin_id: string
          changed_by: string
          changed_by_name?: string | null
          created_at?: string
          id?: string
          new_value: Json
          note?: string | null
          old_value?: Json | null
          setting_key: string
        }
        Update: {
          admin_id?: string
          changed_by?: string
          changed_by_name?: string | null
          created_at?: string
          id?: string
          new_value?: Json
          note?: string | null
          old_value?: Json | null
          setting_key?: string
        }
        Relationships: []
      }
      shop_targets: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          period_month: string
          shop_id: string | null
          target_followups: number
          target_recovered: number
          updated_at: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          period_month: string
          shop_id?: string | null
          target_followups?: number
          target_recovered?: number
          updated_at?: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          period_month?: string
          shop_id?: string | null
          target_followups?: number
          target_recovered?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_targets_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
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
      stock_requirement_events: {
        Row: {
          actor_id: string
          actor_name: string | null
          admin_id: string
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          requirement_id: string
          to_status: string
        }
        Insert: {
          actor_id: string
          actor_name?: string | null
          admin_id: string
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          requirement_id: string
          to_status: string
        }
        Update: {
          actor_id?: string
          actor_name?: string | null
          admin_id?: string
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          requirement_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_requirement_events_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "stock_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_requirements: {
        Row: {
          admin_id: string
          category: string | null
          created_at: string
          id: string
          moved_at: string | null
          moved_by: string | null
          moved_by_name: string | null
          moved_note: string | null
          note: string | null
          packed_at: string | null
          packed_by: string | null
          packed_by_name: string | null
          packed_note: string | null
          packed_qty: number | null
          quantity: number
          received_at: string | null
          received_by: string | null
          received_by_name: string | null
          reject_reason: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejected_by_name: string | null
          requested_by: string
          requested_by_name: string | null
          shop_id: string | null
          shop_name: string | null
          size: string
          status: string
          updated_at: string
          urgency: string
        }
        Insert: {
          admin_id: string
          category?: string | null
          created_at?: string
          id?: string
          moved_at?: string | null
          moved_by?: string | null
          moved_by_name?: string | null
          moved_note?: string | null
          note?: string | null
          packed_at?: string | null
          packed_by?: string | null
          packed_by_name?: string | null
          packed_note?: string | null
          packed_qty?: number | null
          quantity?: number
          received_at?: string | null
          received_by?: string | null
          received_by_name?: string | null
          reject_reason?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejected_by_name?: string | null
          requested_by: string
          requested_by_name?: string | null
          shop_id?: string | null
          shop_name?: string | null
          size: string
          status?: string
          updated_at?: string
          urgency?: string
        }
        Update: {
          admin_id?: string
          category?: string | null
          created_at?: string
          id?: string
          moved_at?: string | null
          moved_by?: string | null
          moved_by_name?: string | null
          moved_note?: string | null
          note?: string | null
          packed_at?: string | null
          packed_by?: string | null
          packed_by_name?: string | null
          packed_note?: string | null
          packed_qty?: number | null
          quantity?: number
          received_at?: string | null
          received_by?: string | null
          received_by_name?: string | null
          reject_reason?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejected_by_name?: string | null
          requested_by?: string
          requested_by_name?: string | null
          shop_id?: string | null
          shop_name?: string | null
          size?: string
          status?: string
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_requirements_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          admin_id: string | null
          created_at: string
          device_id: string
          device_label: string | null
          id: string
          last_active_at: string
          revoked_at: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          device_id: string
          device_label?: string | null
          id?: string
          last_active_at?: string
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          device_id?: string
          device_label?: string | null
          id?: string
          last_active_at?: string
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_contacts: {
        Row: {
          admin_id: string
          created_at: string
          display_name: string | null
          id: string
          is_approved: boolean
          last_message_at: string | null
          phone: string
          profile_id: string | null
          updated_at: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          display_name?: string | null
          id?: string
          is_approved?: boolean
          last_message_at?: string | null
          phone: string
          profile_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          display_name?: string | null
          id?: string
          is_approved?: boolean
          last_message_at?: string | null
          phone?: string
          profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_contacts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_sessions: {
        Row: {
          admin_id: string | null
          created_at: string
          draft: Json
          expires_at: string
          id: string
          options: Json
          phone: string
          profile_id: string | null
          step: string
          updated_at: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          draft?: Json
          expires_at?: string
          id?: string
          options?: Json
          phone: string
          profile_id?: string | null
          step?: string
          updated_at?: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          draft?: Json
          expires_at?: string
          id?: string
          options?: Json
          phone?: string
          profile_id?: string | null
          step?: string
          updated_at?: string
        }
        Relationships: []
      }
      wa_webhook_events: {
        Row: {
          admin_id: string | null
          attempts: number
          created_at: string
          entry_id: string | null
          error_message: string | null
          event_id: string
          follow_up_id: string | null
          id: string
          kind: string
          payload: Json
          phone: string | null
          processed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_id?: string | null
          attempts?: number
          created_at?: string
          entry_id?: string | null
          error_message?: string | null
          event_id: string
          follow_up_id?: string | null
          id?: string
          kind?: string
          payload?: Json
          phone?: string | null
          processed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_id?: string | null
          attempts?: number
          created_at?: string
          entry_id?: string | null
          error_message?: string | null
          event_id?: string
          follow_up_id?: string | null
          id?: string
          kind?: string
          payload?: Json
          phone?: string | null
          processed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_webhook_events_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "goods_damaged_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_webhook_events_follow_up_id_fkey"
            columns: ["follow_up_id"]
            isOneToOne: false
            referencedRelation: "follow_ups"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_digests: {
        Row: {
          admin_id: string
          created_at: string
          emailed_to: string | null
          headline: string
          id: string
          payload: Json
          period_end: string
          period_start: string
          read_at: string | null
          updated_at: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          emailed_to?: string | null
          headline: string
          id?: string
          payload?: Json
          period_end: string
          period_start: string
          read_at?: string | null
          updated_at?: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          emailed_to?: string | null
          headline?: string
          id?: string
          payload?: Json
          period_end?: string
          period_start?: string
          read_at?: string | null
          updated_at?: string
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
      can_access_requirement: {
        Args: { _admin_id: string; _requested_by: string; _shop_id: string }
        Returns: boolean
      }
      can_fulfil_requirement: {
        Args: { _admin_id: string; _shop_id: string }
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
          max_requirements_monthly: number | null
          max_shops: number | null
          max_users: number | null
          max_warehouse_users: number | null
          name: string
          requirements_enabled: boolean
          role: string
          shop_id: string | null
          status: string
          updated_at: string | null
          user_id: string | null
          warehouse_all_shops: boolean
          warehouse_shop_ids: string[]
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
