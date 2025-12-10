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
      api_ciclofaturamento: {
        Row: {
          billing_period_end_date: string
          billing_period_start_date: string
          ciclo_id: number
          configuracao_id: number
          created_at: string
          id: number
          updated_at: string
        }
        Insert: {
          billing_period_end_date: string
          billing_period_start_date: string
          ciclo_id: number
          configuracao_id: number
          created_at: string
          id?: number
          updated_at: string
        }
        Update: {
          billing_period_end_date?: string
          billing_period_start_date?: string
          ciclo_id?: number
          configuracao_id?: number
          created_at?: string
          id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_ciclofaturamento_configuracao_id_72dce789_fk_api_confi"
            columns: ["configuracao_id"]
            isOneToOne: false
            referencedRelation: "api_configuracaoidmc"
            referencedColumns: ["id"]
          },
        ]
      }
      api_clientes: {
        Row: {
          ativo: boolean
          data_criacao: string
          email_contato: string
          id: number
          nome_cliente: string
          preco_por_ipu: number
          qtd_ipus_contratadas: number | null
        }
        Insert: {
          ativo: boolean
          data_criacao: string
          email_contato: string
          id?: number
          nome_cliente: string
          preco_por_ipu: number
          qtd_ipus_contratadas?: number | null
        }
        Update: {
          ativo?: boolean
          data_criacao?: string
          email_contato?: string
          id?: number
          nome_cliente?: string
          preco_por_ipu?: number
          qtd_ipus_contratadas?: number | null
        }
        Relationships: []
      }
      api_configuracaoidmc: {
        Row: {
          apelido_configuracao: string
          ativo: boolean
          cliente_id: number
          data_criacao: string
          id: number
          iics_password: string
          iics_pod_url: string
          iics_username: string
          ultima_extracao_enddate: string | null
        }
        Insert: {
          apelido_configuracao: string
          ativo: boolean
          cliente_id: number
          data_criacao: string
          id?: number
          iics_password: string
          iics_pod_url: string
          iics_username: string
          ultima_extracao_enddate?: string | null
        }
        Update: {
          apelido_configuracao?: string
          ativo?: boolean
          cliente_id?: number
          data_criacao?: string
          id?: number
          iics_password?: string
          iics_pod_url?: string
          iics_username?: string
          ultima_extracao_enddate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_configuracaoidmc_cliente_id_6e2055be_fk_api_clientes_id"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "api_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      api_consumoasset: {
        Row: {
          asset_name: string | null
          asset_type: string | null
          configuracao_id: number
          consumption_date: string | null
          consumption_ipu: number | null
          data_atualizacao: string | null
          data_extracao: string
          environment_type: string | null
          folder_name: string | null
          id: number
          ipu_per_unit: number | null
          meter_id: string | null
          meter_name: string | null
          org_id: string | null
          org_type: string | null
          project_name: string | null
          runtime_environment: string | null
          tier: string | null
          usage: number | null
        }
        Insert: {
          asset_name?: string | null
          asset_type?: string | null
          configuracao_id: number
          consumption_date?: string | null
          consumption_ipu?: number | null
          data_atualizacao?: string | null
          data_extracao?: string
          environment_type?: string | null
          folder_name?: string | null
          id?: number
          ipu_per_unit?: number | null
          meter_id?: string | null
          meter_name?: string | null
          org_id?: string | null
          org_type?: string | null
          project_name?: string | null
          runtime_environment?: string | null
          tier?: string | null
          usage?: number | null
        }
        Update: {
          asset_name?: string | null
          asset_type?: string | null
          configuracao_id?: number
          consumption_date?: string | null
          consumption_ipu?: number | null
          data_atualizacao?: string | null
          data_extracao?: string
          environment_type?: string | null
          folder_name?: string | null
          id?: number
          ipu_per_unit?: number | null
          meter_id?: string | null
          meter_name?: string | null
          org_id?: string | null
          org_type?: string | null
          project_name?: string | null
          runtime_environment?: string | null
          tier?: string | null
          usage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_consumoasset_configuracao_id_fkey"
            columns: ["configuracao_id"]
            isOneToOne: false
            referencedRelation: "api_configuracaoidmc"
            referencedColumns: ["id"]
          },
        ]
      }
      api_consumocaiassetsumario: {
        Row: {
          avg_execution_time_seconds: number | null
          configuracao_id: number
          data_atualizacao: string | null
          data_extracao: string
          executed_asset: string | null
          execution_count: number | null
          execution_date: string | null
          execution_env: string | null
          execution_type: string | null
          id: number
          invoked_by: string | null
          meter_id: string | null
          org_id: string | null
          status: string | null
          total_execution_time_hours: number | null
        }
        Insert: {
          avg_execution_time_seconds?: number | null
          configuracao_id: number
          data_atualizacao?: string | null
          data_extracao?: string
          executed_asset?: string | null
          execution_count?: number | null
          execution_date?: string | null
          execution_env?: string | null
          execution_type?: string | null
          id?: number
          invoked_by?: string | null
          meter_id?: string | null
          org_id?: string | null
          status?: string | null
          total_execution_time_hours?: number | null
        }
        Update: {
          avg_execution_time_seconds?: number | null
          configuracao_id?: number
          data_atualizacao?: string | null
          data_extracao?: string
          executed_asset?: string | null
          execution_count?: number | null
          execution_date?: string | null
          execution_env?: string | null
          execution_type?: string | null
          id?: number
          invoked_by?: string | null
          meter_id?: string | null
          org_id?: string | null
          status?: string | null
          total_execution_time_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_consumocaiassetsumario_configuracao_id_fkey"
            columns: ["configuracao_id"]
            isOneToOne: false
            referencedRelation: "api_configuracaoidmc"
            referencedColumns: ["id"]
          },
        ]
      }
      api_consumocdijobexecucao: {
        Row: {
          audit_time: string | null
          configuracao_id: number
          cores_used: number | null
          data_atualizacao: string | null
          data_extracao: string
          end_time: string | null
          environment_id: string | null
          environment_name: string | null
          folder_name: string | null
          id: number
          meter_id: string | null
          meter_id_ref: string | null
          metered_value_ipu: number | null
          obm_task_time_seconds: number | null
          org_id: string | null
          project_name: string | null
          start_time: string | null
          status: string | null
          task_id: string | null
          task_name: string | null
          task_object_name: string | null
          task_run_id: string | null
          task_type: string | null
        }
        Insert: {
          audit_time?: string | null
          configuracao_id: number
          cores_used?: number | null
          data_atualizacao?: string | null
          data_extracao?: string
          end_time?: string | null
          environment_id?: string | null
          environment_name?: string | null
          folder_name?: string | null
          id?: number
          meter_id?: string | null
          meter_id_ref?: string | null
          metered_value_ipu?: number | null
          obm_task_time_seconds?: number | null
          org_id?: string | null
          project_name?: string | null
          start_time?: string | null
          status?: string | null
          task_id?: string | null
          task_name?: string | null
          task_object_name?: string | null
          task_run_id?: string | null
          task_type?: string | null
        }
        Update: {
          audit_time?: string | null
          configuracao_id?: number
          cores_used?: number | null
          data_atualizacao?: string | null
          data_extracao?: string
          end_time?: string | null
          environment_id?: string | null
          environment_name?: string | null
          folder_name?: string | null
          id?: number
          meter_id?: string | null
          meter_id_ref?: string | null
          metered_value_ipu?: number | null
          obm_task_time_seconds?: number | null
          org_id?: string | null
          project_name?: string | null
          start_time?: string | null
          status?: string | null
          task_id?: string | null
          task_name?: string | null
          task_object_name?: string | null
          task_run_id?: string | null
          task_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_consumocdijobexecucao_configuracao_id_fkey"
            columns: ["configuracao_id"]
            isOneToOne: false
            referencedRelation: "api_configuracaoidmc"
            referencedColumns: ["id"]
          },
        ]
      }
      api_consumoprojectfolder: {
        Row: {
          configuracao_id: number
          consumption_date: string | null
          data_atualizacao: string | null
          data_extracao: string
          folder_path: string | null
          id: number
          org_id: string | null
          org_type: string | null
          project_name: string | null
          total_consumption_ipu: number | null
        }
        Insert: {
          configuracao_id: number
          consumption_date?: string | null
          data_atualizacao?: string | null
          data_extracao?: string
          folder_path?: string | null
          id?: number
          org_id?: string | null
          org_type?: string | null
          project_name?: string | null
          total_consumption_ipu?: number | null
        }
        Update: {
          configuracao_id?: number
          consumption_date?: string | null
          data_atualizacao?: string | null
          data_extracao?: string
          folder_path?: string | null
          id?: number
          org_id?: string | null
          org_type?: string | null
          project_name?: string | null
          total_consumption_ipu?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_consumoprojectfolder_configuracao_id_fkey"
            columns: ["configuracao_id"]
            isOneToOne: false
            referencedRelation: "api_configuracaoidmc"
            referencedColumns: ["id"]
          },
        ]
      }
      api_consumosummary: {
        Row: {
          billing_period_end_date: string | null
          billing_period_start_date: string | null
          configuracao_id: number
          consumption_date: string | null
          consumption_ipu: number | null
          data_atualizacao: string | null
          data_extracao: string
          id: number
          ipu_rate: number | null
          meter_id: string | null
          meter_name: string | null
          meter_usage: number | null
          metric_category: string | null
          org_id: string | null
          org_name: string | null
          org_type: string | null
          scalar: string | null
        }
        Insert: {
          billing_period_end_date?: string | null
          billing_period_start_date?: string | null
          configuracao_id: number
          consumption_date?: string | null
          consumption_ipu?: number | null
          data_atualizacao?: string | null
          data_extracao?: string
          id?: number
          ipu_rate?: number | null
          meter_id?: string | null
          meter_name?: string | null
          meter_usage?: number | null
          metric_category?: string | null
          org_id?: string | null
          org_name?: string | null
          org_type?: string | null
          scalar?: string | null
        }
        Update: {
          billing_period_end_date?: string | null
          billing_period_start_date?: string | null
          configuracao_id?: number
          consumption_date?: string | null
          consumption_ipu?: number | null
          data_atualizacao?: string | null
          data_extracao?: string
          id?: number
          ipu_rate?: number | null
          meter_id?: string | null
          meter_name?: string | null
          meter_usage?: number | null
          metric_category?: string | null
          org_id?: string | null
          org_name?: string | null
          org_type?: string | null
          scalar?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_consumosummary_configuracao_id_fkey"
            columns: ["configuracao_id"]
            isOneToOne: false
            referencedRelation: "api_configuracaoidmc"
            referencedColumns: ["id"]
          },
        ]
      }
      api_extracaolog: {
        Row: {
          configuracao_id: number
          detalhes: string | null
          etapa: string
          id: number
          mensagem_erro: string | null
          resposta_api: string | null
          status: string
          timestamp: string
        }
        Insert: {
          configuracao_id: number
          detalhes?: string | null
          etapa: string
          id?: number
          mensagem_erro?: string | null
          resposta_api?: string | null
          status: string
          timestamp: string
        }
        Update: {
          configuracao_id?: number
          detalhes?: string | null
          etapa?: string
          id?: number
          mensagem_erro?: string | null
          resposta_api?: string | null
          status?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_extracaolog_configuracao_id_fk_api_confi"
            columns: ["configuracao_id"]
            isOneToOne: false
            referencedRelation: "api_configuracaoidmc"
            referencedColumns: ["id"]
          },
        ]
      }
      api_tags_customizadas: {
        Row: {
          asset_name: string | null
          asset_type: string | null
          configuracao_id: number
          created_at: string
          folder_name: string | null
          id: number
          meter_id: string | null
          project_name: string | null
          tag_color: string | null
          tag_name: string
          updated_at: string
        }
        Insert: {
          asset_name?: string | null
          asset_type?: string | null
          configuracao_id: number
          created_at?: string
          folder_name?: string | null
          id?: number
          meter_id?: string | null
          project_name?: string | null
          tag_color?: string | null
          tag_name: string
          updated_at?: string
        }
        Update: {
          asset_name?: string | null
          asset_type?: string | null
          configuracao_id?: number
          created_at?: string
          folder_name?: string | null
          id?: number
          meter_id?: string | null
          project_name?: string | null
          tag_color?: string | null
          tag_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      auth_group: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id?: number
          name: string
        }
        Update: {
          id?: number
          name?: string
        }
        Relationships: []
      }
      auth_group_permissions: {
        Row: {
          group_id: number
          id: number
          permission_id: number
        }
        Insert: {
          group_id: number
          id?: number
          permission_id: number
        }
        Update: {
          group_id?: number
          id?: number
          permission_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "auth_group_permissio_permission_id_84c5c92e_fk_auth_perm"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "auth_permission"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_group_permissions_group_id_b120cbf9_fk_auth_group_id"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "auth_group"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_permission: {
        Row: {
          codename: string
          content_type_id: number
          id: number
          name: string
        }
        Insert: {
          codename: string
          content_type_id: number
          id?: number
          name: string
        }
        Update: {
          codename?: string
          content_type_id?: number
          id?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "auth_permission_content_type_id_2f476e4b_fk_django_co"
            columns: ["content_type_id"]
            isOneToOne: false
            referencedRelation: "django_content_type"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_user: {
        Row: {
          date_joined: string
          email: string
          first_name: string
          id: number
          is_active: boolean
          is_staff: boolean
          is_superuser: boolean
          last_login: string | null
          last_name: string
          password: string
          username: string
        }
        Insert: {
          date_joined: string
          email: string
          first_name: string
          id?: number
          is_active: boolean
          is_staff: boolean
          is_superuser: boolean
          last_login?: string | null
          last_name: string
          password: string
          username: string
        }
        Update: {
          date_joined?: string
          email?: string
          first_name?: string
          id?: number
          is_active?: boolean
          is_staff?: boolean
          is_superuser?: boolean
          last_login?: string | null
          last_name?: string
          password?: string
          username?: string
        }
        Relationships: []
      }
      auth_user_groups: {
        Row: {
          group_id: number
          id: number
          user_id: number
        }
        Insert: {
          group_id: number
          id?: number
          user_id: number
        }
        Update: {
          group_id?: number
          id?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "auth_user_groups_group_id_97559544_fk_auth_group_id"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "auth_group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_user_groups_user_id_6a12ed8b_fk_auth_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_user"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_user_user_permissions: {
        Row: {
          id: number
          permission_id: number
          user_id: number
        }
        Insert: {
          id?: number
          permission_id: number
          user_id: number
        }
        Update: {
          id?: number
          permission_id?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "auth_user_user_permi_permission_id_1fbb5f2c_fk_auth_perm"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "auth_permission"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_user_user_permissions_user_id_a95ead1b_fk_auth_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_user"
            referencedColumns: ["id"]
          },
        ]
      }
      django_admin_log: {
        Row: {
          action_flag: number
          action_time: string
          change_message: string
          content_type_id: number | null
          id: number
          object_id: string | null
          object_repr: string
          user_id: number
        }
        Insert: {
          action_flag: number
          action_time: string
          change_message: string
          content_type_id?: number | null
          id?: number
          object_id?: string | null
          object_repr: string
          user_id: number
        }
        Update: {
          action_flag?: number
          action_time?: string
          change_message?: string
          content_type_id?: number | null
          id?: number
          object_id?: string | null
          object_repr?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "django_admin_log_content_type_id_c4bce8eb_fk_django_co"
            columns: ["content_type_id"]
            isOneToOne: false
            referencedRelation: "django_content_type"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "django_admin_log_user_id_c564eba6_fk_auth_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_user"
            referencedColumns: ["id"]
          },
        ]
      }
      django_content_type: {
        Row: {
          app_label: string
          id: number
          model: string
        }
        Insert: {
          app_label: string
          id?: number
          model: string
        }
        Update: {
          app_label?: string
          id?: number
          model?: string
        }
        Relationships: []
      }
      django_migrations: {
        Row: {
          app: string
          applied: string
          id: number
          name: string
        }
        Insert: {
          app: string
          applied: string
          id?: number
          name: string
        }
        Update: {
          app?: string
          applied?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      django_session: {
        Row: {
          expire_date: string
          session_data: string
          session_key: string
        }
        Insert: {
          expire_date: string
          session_data: string
          session_key: string
        }
        Update: {
          expire_date?: string
          session_data?: string
          session_key?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cliente_id: number | null
          created_at: string | null
          id: string
          plan_type: Database["public"]["Enums"]["plan_type"] | null
          updated_at: string | null
          user_role: Database["public"]["Enums"]["user_role"] | null
        }
        Insert: {
          cliente_id?: number | null
          created_at?: string | null
          id: string
          plan_type?: Database["public"]["Enums"]["plan_type"] | null
          updated_at?: string | null
          user_role?: Database["public"]["Enums"]["user_role"] | null
        }
        Update: {
          cliente_id?: number | null
          created_at?: string | null
          id?: string
          plan_type?: Database["public"]["Enums"]["plan_type"] | null
          updated_at?: string | null
          user_role?: Database["public"]["Enums"]["user_role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "api_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_available_cycles: {
        Args: Record<PropertyKey, never>
        Returns: {
          billing_period_end_date: string
          billing_period_start_date: string
        }[]
      }
      get_billing_cycles_with_data: {
        Args: { config_ids: number[] }
        Returns: {
          billing_period_end_date: string
          billing_period_start_date: string
          ciclo_id: number
          configuracao_id: number
          has_consumption: boolean
        }[]
      }
      get_billing_periods_data: {
        Args: { cycle_limit?: number; org_filter?: string }
        Returns: {
          billing_period_end_date: string
          billing_period_start_date: string
          consumption_ipu: number
          meter_name: string
          org_id: string
          org_name: string
        }[]
      }
      get_cost_distribution_data: {
        Args: { end_date?: string; start_date?: string }
        Returns: {
          consumption_ipu: number
          org_id: string
          org_name: string
        }[]
      }
      get_cost_evolution_data: {
        Args: { cycle_limit?: number; org_filter?: string }
        Returns: {
          billing_period_end_date: string
          billing_period_start_date: string
          consumption_ipu: number
          org_id: string
          org_name: string
        }[]
      }
      get_dashboard_kpis: {
        Args: { end_date?: string; org_filter?: string; start_date?: string }
        Returns: {
          active_orgs: number
          billing_period_end_date: string
          billing_period_start_date: string
          configuracao_id: number
          total_ipu: number
        }[]
      }
      get_organization_details_data: {
        Args: { end_date?: string; start_date?: string }
        Returns: {
          consumption_ipu: number
          org_id: string
          org_name: string
        }[]
      }
      get_project_consumption_data: {
        Args: {
          p_end_date: string
          p_selected_project?: string
          p_start_date: string
        }
        Returns: {
          consumption_date: string
          consumption_ipu: number
          project_name: string
        }[]
      }
    }
    Enums: {
      plan_type: "starter" | "essential" | "pro" | "business"
      user_role: "user" | "admin"
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
    Enums: {
      plan_type: ["starter", "essential", "pro", "business"],
      user_role: ["user", "admin"],
    },
  },
} as const
