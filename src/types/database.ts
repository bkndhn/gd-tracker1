
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
          role: 'super_admin' | 'admin' | 'user' | 'manager';
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
        };
        Insert: {
          id: string;
          name: string;
          user_id: string;
          role?: 'super_admin' | 'admin' | 'user' | 'manager';
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
        };
        Update: {
          id?: string;
          name?: string;
          user_id?: string;
          role?: 'super_admin' | 'admin' | 'user' | 'manager';
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
