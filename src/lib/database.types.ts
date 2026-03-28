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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      aux_coef_emparejamientos: {
        Row: {
          coef_repeticion: number | null
          id_comunidad: string
          id_pareja: string
          id_persona: string
        }
        Insert: {
          coef_repeticion?: number | null
          id_comunidad: string
          id_pareja: string
          id_persona: string
        }
        Update: {
          coef_repeticion?: number | null
          id_comunidad?: string
          id_pareja?: string
          id_persona?: string
        }
        Relationships: [
          {
            foreignKeyName: "aux_coef_emparejamientos_id_comunidad_fkey"
            columns: ["id_comunidad"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aux_coef_emparejamientos_id_pareja_fkey"
            columns: ["id_pareja"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aux_coef_emparejamientos_id_persona_fkey"
            columns: ["id_persona"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      celebraciones: {
        Row: {
          id_celebracion: string
          nombre: string
        }
        Insert: {
          id_celebracion: string
          nombre: string
        }
        Update: {
          id_celebracion?: string
          nombre?: string
        }
        Relationships: []
      }
      comunidades: {
        Row: {
          id: string
          numero: string
          parroquia: string
        }
        Insert: {
          id?: string
          numero: string
          parroquia: string
        }
        Update: {
          id?: string
          numero?: string
          parroquia?: string
        }
        Relationships: []
      }
      configuracion: {
        Row: {
          codigo: string
          referencial: string
          valor: string
        }
        Insert: {
          codigo: string
          referencial: string
          valor: string
        }
        Update: {
          codigo?: string
          referencial?: string
          valor?: string
        }
        Relationships: []
      }
      grupos: {
        Row: {
          descripcion: string | null
          fec_celebracion: string | null
          id: string
          id_comunidad: string
          id_generacion: number
          id_grupo: number
          tipo: string
        }
        Insert: {
          descripcion?: string | null
          fec_celebracion?: string | null
          id?: string
          id_comunidad: string
          id_generacion: number
          id_grupo: number
          tipo: string
        }
        Update: {
          descripcion?: string | null
          fec_celebracion?: string | null
          id?: string
          id_comunidad?: string
          id_generacion?: number
          id_grupo?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "grupos_id_comunidad_fkey"
            columns: ["id_comunidad"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grupos_tipo_fkey"
            columns: ["tipo"]
            isOneToOne: false
            referencedRelation: "celebraciones"
            referencedColumns: ["id_celebracion"]
          },
        ]
      }
      personas: {
        Row: {
          id: string
          id_comunidad: string
          is_disponible: boolean
          nombre: string
          numero: number
        }
        Insert: {
          id?: string
          id_comunidad: string
          is_disponible?: boolean
          nombre: string
          numero: number
        }
        Update: {
          id?: string
          id_comunidad?: string
          is_disponible?: boolean
          nombre?: string
          numero?: number
        }
        Relationships: [
          {
            foreignKeyName: "personas_id_comunidad_fkey"
            columns: ["id_comunidad"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      rel_comunidad_celebracion: {
        Row: {
          id_celebracion: string
          id_comunidad: string
          num_grupos: number
        }
        Insert: {
          id_celebracion: string
          id_comunidad: string
          num_grupos: number
        }
        Update: {
          id_celebracion?: string
          id_comunidad?: string
          num_grupos?: number
        }
        Relationships: [
          {
            foreignKeyName: "rel_comunidad_celebracion_id_celebracion_fkey"
            columns: ["id_celebracion"]
            isOneToOne: false
            referencedRelation: "celebraciones"
            referencedColumns: ["id_celebracion"]
          },
          {
            foreignKeyName: "rel_comunidad_celebracion_id_comunidad_fkey"
            columns: ["id_comunidad"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      rel_persona_grupo: {
        Row: {
          id_comunidad: string
          id_generacion: number
          id_grupo: number
          id_persona: string | null
          tipo: string
        }
        Insert: {
          id_comunidad: string
          id_generacion: number
          id_grupo: number
          id_persona?: string | null
          tipo: string
        }
        Update: {
          id_comunidad?: string
          id_generacion?: number
          id_grupo?: number
          id_persona?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "rel_persona_grupo_id_persona_fkey"
            columns: ["id_persona"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rel_persona_grupo_tipo_fkey"
            columns: ["tipo"]
            isOneToOne: false
            referencedRelation: "celebraciones"
            referencedColumns: ["id_celebracion"]
          },
        ]
      }
      rel_persona_grupo_temp: {
        Row: {
          coef_maximo: number | null
          coef_minimo: number | null
          coef_repeticion: number | null
          id_comunidad: string
          id_generacion: number
          id_grupo: number
          id_persona: string | null
          num_grupos: number
        }
        Insert: {
          coef_maximo?: number | null
          coef_minimo?: number | null
          coef_repeticion?: number | null
          id_comunidad: string
          id_generacion: number
          id_grupo: number
          id_persona?: string | null
          num_grupos: number
        }
        Update: {
          coef_maximo?: number | null
          coef_minimo?: number | null
          coef_repeticion?: number | null
          id_comunidad?: string
          id_generacion?: number
          id_grupo?: number
          id_persona?: string | null
          num_grupos?: number
        }
        Relationships: [
          {
            foreignKeyName: "rel_persona_grupo_temp_id_comunidad_fkey"
            columns: ["id_comunidad"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rel_persona_grupo_temp_id_persona_fkey"
            columns: ["id_persona"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
