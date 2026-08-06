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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json
          entity: string | null
          entity_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          entity?: string | null
          entity_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          entity?: string | null
          entity_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      body_chart_marks: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          mark_type: string
          note: string | null
          patient_id: string
          session_id: string | null
          view: string
          x: number
          y: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          mark_type: string
          note?: string | null
          patient_id: string
          session_id?: string | null
          view?: string
          x: number
          y: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          mark_type?: string
          note?: string | null
          patient_id?: string
          session_id?: string | null
          view?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "body_chart_marks_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "body_chart_marks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "treatment_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      clinical_fields: {
        Row: {
          created_at: string
          created_by: string | null
          field_type: string
          id: string
          is_suggestion: boolean
          label: string
          label_ar: string | null
          module: string
          options: Json
          section: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          field_type?: string
          id?: string
          is_suggestion?: boolean
          label: string
          label_ar?: string | null
          module: string
          options?: Json
          section?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          field_type?: string
          id?: string
          is_suggestion?: boolean
          label?: string
          label_ar?: string | null
          module?: string
          options?: Json
          section?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      exercise_logs: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          log_date: string
          notes: string | null
          patient_exercise_id: string
          patient_id: string
          recorded_by: string | null
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          log_date?: string
          notes?: string | null
          patient_exercise_id: string
          patient_id: string
          recorded_by?: string | null
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          log_date?: string
          notes?: string | null
          patient_exercise_id?: string
          patient_id?: string
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_logs_patient_exercise_id_fkey"
            columns: ["patient_exercise_id"]
            isOneToOne: false
            referencedRelation: "patient_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          category: string | null
          contraindications: string | null
          created_at: string
          created_by: string | null
          description: string | null
          difficulty: string | null
          duration: string | null
          extra: Json
          frequency: string | null
          id: string
          image_url: string | null
          instructions: string | null
          name: string
          progression: string | null
          regression: string | null
          repetitions: string | null
          sets: string | null
          target_muscle: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          category?: string | null
          contraindications?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty?: string | null
          duration?: string | null
          extra?: Json
          frequency?: string | null
          id?: string
          image_url?: string | null
          instructions?: string | null
          name: string
          progression?: string | null
          regression?: string | null
          repetitions?: string | null
          sets?: string | null
          target_muscle?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          category?: string | null
          contraindications?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty?: string | null
          duration?: string | null
          extra?: Json
          frequency?: string | null
          id?: string
          image_url?: string | null
          instructions?: string | null
          name?: string
          progression?: string | null
          regression?: string | null
          repetitions?: string | null
          sets?: string | null
          target_muscle?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          discount: number
          id: string
          invoice_number: string
          issue_date: string
          patient_id: string
          sessions_count: number | null
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount?: number
          id?: string
          invoice_number?: string
          issue_date?: string
          patient_id: string
          sessions_count?: number | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount?: number
          id?: string
          invoice_number?: string
          issue_date?: string
          patient_id?: string
          sessions_count?: number | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      measurements: {
        Row: {
          created_at: string
          id: string
          measured_on: string
          metric: string
          patient_id: string
          recorded_by: string | null
          session_id: string | null
          unit: string | null
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          measured_on?: string
          metric: string
          patient_id: string
          recorded_by?: string | null
          session_id?: string | null
          unit?: string | null
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          measured_on?: string
          metric?: string
          patient_id?: string
          recorded_by?: string | null
          session_id?: string | null
          unit?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "measurements_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "treatment_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          due_at: string | null
          id: string
          is_read: boolean
          patient_id: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          is_read?: boolean
          patient_id?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          is_read?: boolean
          patient_id?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_codes: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          email: string
          expires_at: string
          id: string
          used_at: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          used_at?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          used_at?: string | null
        }
        Relationships: []
      }
      patient_exercises: {
        Row: {
          assigned_by: string | null
          created_at: string
          exercise_id: string | null
          frequency: string | null
          id: string
          notes: string | null
          patient_id: string
          repetitions: string | null
          sets: string | null
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          exercise_id?: string | null
          frequency?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          repetitions?: string | null
          sets?: string | null
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          exercise_id?: string | null
          frequency?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          repetitions?: string | null
          sets?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_exercises_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_files: {
        Row: {
          category: string
          created_at: string
          drive_file_id: string | null
          drive_web_view_link: string | null
          file_name: string
          id: string
          mime_type: string | null
          patient_id: string
          size_bytes: number | null
          storage_account_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          drive_file_id?: string | null
          drive_web_view_link?: string | null
          file_name: string
          id?: string
          mime_type?: string | null
          patient_id: string
          size_bytes?: number | null
          storage_account_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          drive_file_id?: string | null
          drive_web_view_link?: string | null
          file_name?: string
          id?: string
          mime_type?: string | null
          patient_id?: string
          size_bytes?: number | null
          storage_account_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_files_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_records: {
        Row: {
          created_at: string
          id: string
          label: string
          module: string
          patient_id: string
          recorded_by: string | null
          session_id: string | null
          sort_order: number
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          module: string
          patient_id: string
          recorded_by?: string | null
          session_id?: string | null
          sort_order?: number
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          module?: string
          patient_id?: string
          recorded_by?: string | null
          session_id?: string | null
          sort_order?: number
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          age: number | null
          code: string
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          deleted_at: string | null
          diagnosis: string | null
          email: string | null
          extra: Json
          full_name: string
          gender: string | null
          id: string
          marital_status: string | null
          notes: string | null
          occupation: string | null
          phone: string | null
          phone_alt: string | null
          primary_therapist_id: string | null
          referral_source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          age?: number | null
          code?: string
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          diagnosis?: string | null
          email?: string | null
          extra?: Json
          full_name: string
          gender?: string | null
          id?: string
          marital_status?: string | null
          notes?: string | null
          occupation?: string | null
          phone?: string | null
          phone_alt?: string | null
          primary_therapist_id?: string | null
          referral_source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          age?: number | null
          code?: string
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          diagnosis?: string | null
          email?: string | null
          extra?: Json
          full_name?: string
          gender?: string | null
          id?: string
          marital_status?: string | null
          notes?: string | null
          occupation?: string | null
          phone?: string | null
          phone_alt?: string | null
          primary_therapist_id?: string | null
          referral_source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string | null
          is_refund: boolean
          method: string
          note: string | null
          paid_on: string
          patient_id: string
          received_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          is_refund?: boolean
          method?: string
          note?: string | null
          paid_on?: string
          patient_id: string
          received_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          is_refund?: boolean
          method?: string
          note?: string | null
          paid_on?: string
          patient_id?: string
          received_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      storage_accounts: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          is_primary: boolean
          label: string | null
          root_folder_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          label?: string | null
          root_folder_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          label?: string | null
          root_folder_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      treatment_sessions: {
        Row: {
          assessment: string | null
          attendance: string
          compliance: string | null
          complications: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          next_session_plan: string | null
          objective: string | null
          pain_after: number | null
          pain_before: number | null
          patient_id: string
          plan: string | null
          response: string | null
          session_date: string
          session_number: number
          signature: string | null
          subjective: string | null
          therapist_id: string | null
          updated_at: string
        }
        Insert: {
          assessment?: string | null
          attendance?: string
          compliance?: string | null
          complications?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          next_session_plan?: string | null
          objective?: string | null
          pain_after?: number | null
          pain_before?: number | null
          patient_id: string
          plan?: string | null
          response?: string | null
          session_date?: string
          session_number?: number
          signature?: string | null
          subjective?: string | null
          therapist_id?: string | null
          updated_at?: string
        }
        Update: {
          assessment?: string | null
          attendance?: string
          compliance?: string | null
          complications?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          next_session_plan?: string | null
          objective?: string | null
          pain_after?: number | null
          pain_before?: number | null
          patient_id?: string
          plan?: string | null
          response?: string | null
          session_date?: string
          session_number?: number
          signature?: string | null
          subjective?: string | null
          therapist_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_clinical: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "super_admin" | "therapist" | "receptionist" | "assistant"
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
      app_role: ["super_admin", "therapist", "receptionist", "assistant"],
    },
  },
} as const
