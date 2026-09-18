
export interface Database {
  public: {
    Tables: {
      shops: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          updated_at: string;
          whatsapp_group_link: string | null;
          deleted_at: string | null;
          admin_id?: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          updated_at?: string;
          whatsapp_group_link?: string | null;
          deleted_at?: string | null;
          admin_id?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
          whatsapp_group_link?: string | null;
          deleted_at?: string | null;
          admin_id?: string | null;
        };
      };
      app_settings: {
        Row: {
          id: string;
          key: string;
          value: Record<string, unknown>;
          created_at: string;
          updated_at: string;
          admin_id: string | null;
        };
        Insert: {
          id?: string;
          key: string;
          value: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
          admin_id?: string | null;
        };
        Update: {
          id?: string;
          key?: string;
          value?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
          admin_id?: string | null;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          admin_id?: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          admin_id?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          admin_id?: string | null;
        };
      };
      sizes: {
        Row: {
          id: string;
          size: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          admin_id?: string | null;
        };
        Insert: {
          id?: string;
          size: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          admin_id?: string | null;
        };
        Update: {
          id?: string;
          size?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          admin_id?: string | null;
        };
      };
      customer_types: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          admin_id?: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          admin_id?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          admin_id?: string | null;
        };
      };
      profiles: {
        Row: {
          id: string;
          name: string;
          user_id: string;
          role: 'super_admin' | 'admin' | 'user' | 'manager' | 'warehouse';
          shop_id: string | null;
          default_category_id: string | null;
          default_size_id: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          email: string | null;
          admin_id: string | null;
          status: 'active' | 'paused';
          max_shops: number | null;
          max_users: number | null;
          last_login_at?: string | null;
          custom_fields_enabled?: boolean;
          max_custom_fields?: number | null;
          max_options_per_field?: number | null;
          theme_color?: string | null;
          warehouse_shop_ids?: string[];
          warehouse_all_shops?: boolean;
          requirements_enabled?: boolean;
          max_requirements_monthly?: number | null;
          max_warehouse_users?: number | null;
          must_change_password?: boolean | null;
          is_temp_password?: boolean | null;
          max_entries?: number | null;
          max_images_per_entry?: number | null;
          max_images_total?: number | null;
          ai_enabled?: boolean;
          ai_daily_limit?: number | null;
          ai_monthly_limit?: number | null;
          ai_lifetime_limit?: number | null;
        };
        Insert: {
          id: string;
          name: string;
          user_id: string;
          role?: 'super_admin' | 'admin' | 'user' | 'manager' | 'warehouse';
          shop_id?: string | null;
          default_category_id?: string | null;
          default_size_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          admin_id?: string | null;
          status?: 'active' | 'paused';
          max_shops?: number | null;
          max_users?: number | null;
          last_login_at?: string | null;
          custom_fields_enabled?: boolean;
          max_custom_fields?: number | null;
          max_options_per_field?: number | null;
          theme_color?: string | null;
          warehouse_shop_ids?: string[];
          warehouse_all_shops?: boolean;
          requirements_enabled?: boolean;
          max_requirements_monthly?: number | null;
          max_warehouse_users?: number | null;
          must_change_password?: boolean | null;
          is_temp_password?: boolean | null;
          max_entries?: number | null;
          max_images_per_entry?: number | null;
          max_images_total?: number | null;
          ai_enabled?: boolean;
          ai_daily_limit?: number | null;
          ai_monthly_limit?: number | null;
          ai_lifetime_limit?: number | null;
        };
        Update: {
          id?: string;
          name?: string;
          user_id?: string;
          role?: 'super_admin' | 'admin' | 'user' | 'manager' | 'warehouse';
          shop_id?: string | null;
          default_category_id?: string | null;
          default_size_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          admin_id?: string | null;
          status?: 'active' | 'paused';
          max_shops?: number | null;
          max_users?: number | null;
          last_login_at?: string | null;
          custom_fields_enabled?: boolean;
          max_custom_fields?: number | null;
          max_options_per_field?: number | null;
          theme_color?: string | null;
          warehouse_shop_ids?: string[];
          warehouse_all_shops?: boolean;
          requirements_enabled?: boolean;
          max_requirements_monthly?: number | null;
          max_warehouse_users?: number | null;
          must_change_password?: boolean | null;
          is_temp_password?: boolean | null;
          max_entries?: number | null;
          max_images_per_entry?: number | null;
          max_images_total?: number | null;
          ai_enabled?: boolean;
          ai_daily_limit?: number | null;
          ai_monthly_limit?: number | null;
          ai_lifetime_limit?: number | null;
        };
      };
      goods_damaged_entries: {
        Row: {
          id: string;
          category_id: string;
          size_id: string;
          employee_id: string;
          employee_name: string | null;
          shop_id: string;
          customer_type_id: string | null;
          notes: string;
          created_at: string;
          updated_at: string;
          image_url?: string | null;
          voice_note_url: string | null;
          admin_id: string | null;
        };
        Insert: {
          id?: string;
          category_id: string;
          size_id: string;
          employee_id: string;
          employee_name?: string | null;
          shop_id: string;
          customer_type_id?: string | null;
          notes: string;
          created_at?: string;
          updated_at?: string;
          image_url?: string | null;
          voice_note_url?: string | null;
          admin_id?: string | null;
        };
        Update: {
          id?: string;
          category_id?: string;
          size_id?: string;
          employee_id?: string;
          employee_name?: string | null;
          shop_id?: string;
          customer_type_id?: string | null;
          notes?: string;
          created_at?: string;
          updated_at?: string;
          image_url?: string | null;
          voice_note_url?: string | null;
          admin_id?: string | null;
        };
      };
    };
  };
}
