export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      body_chart_marks: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          mark_type: string;
          note: string | null;
          patient_id: string;
          session_id: string | null;
          view: string;
          x: number;
          y: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          mark_type: string;
          note?: string | null;
          patient_id: string;
          session_id?: string | null;
          view?: string;
          x: number;
          y: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          mark_type?: string;
          note?: string | null;
          patient_id?: string;
          session_id?: string | null;
          view?: string;
          x?: number;
          y?: number;
        };
        Relationships: [
          {
            foreignKeyName: "body_chart_marks_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "body_chart_marks_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "treatment_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      clinic_settings: {
        Row: {
          id: string;
          key: string;
          updated_at: string;
          value: Json;
        };
        Insert: {
          id?: string;
          key: string;
          updated_at?: string;
          value?: Json;
        };
        Update: {
          id?: string;
          key?: string;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [];
      };
      clinical_fields: {
        Row: {
          created_at: string;
          created_by: string | null;
          field_type: string;
          id: string;
          is_suggestion: boolean;
          label: string;
          label_ar: string | null;
          module: string;
          options: Json;
          section: string | null;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          field_type?: string;
          id?: string;
          is_suggestion?: boolean;
          label: string;
          label_ar?: string | null;
          module: string;
          options?: Json;
          section?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          field_type?: string;
          id?: string;
          is_suggestion?: boolean;
          label?: string;
          label_ar?: string | null;
          module?: string;
          options?: Json;
          section?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      exercise_logs: {
        Row: {
          completed: boolean;
          created_at: string;
          id: string;
          log_date: string;
          notes: string | null;
          patient_exercise_id: string;
          patient_id: string;
          recorded_by: string | null;
        };
        Insert: {
          completed?: boolean;
          created_at?: string;
          id?: string;
          log_date?: string;
          notes?: string | null;
          patient_exercise_id: string;
          patient_id: string;
          recorded_by?: string | null;
        };
        Update: {
          completed?: boolean;
          created_at?: string;
          id?: string;
          log_date?: string;
          notes?: string | null;
          patient_exercise_id?: string;
          patient_id?: string;
          recorded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "exercise_logs_patient_exercise_id_fkey";
            columns: ["patient_exercise_id"];
            isOneToOne: false;
            referencedRelation: "patient_exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exercise_logs_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      exercises: {
        Row: {
          category: string | null;
          contraindications: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          difficulty: string | null;
          duration: string | null;
          extra: Json;
          frequency: string | null;
          id: string;
          image_url: string | null;
          instructions: string | null;
          name: string;
          progression: string | null;
          regression: string | null;
          repetitions: string | null;
          sets: string | null;
          target_muscle: string | null;
          updated_at: string;
          video_url: string | null;
        };
        Insert: {
          category?: string | null;
          contraindications?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          difficulty?: string | null;
          duration?: string | null;
          extra?: Json;
          frequency?: string | null;
          id?: string;
          image_url?: string | null;
          instructions?: string | null;
          name: string;
          progression?: string | null;
          regression?: string | null;
          repetitions?: string | null;
          sets?: string | null;
          target_muscle?: string | null;
          updated_at?: string;
          video_url?: string | null;
        };
        Update: {
          category?: string | null;
          contraindications?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          difficulty?: string | null;
          duration?: string | null;
          extra?: Json;
          frequency?: string | null;
          id?: string;
          image_url?: string | null;
          instructions?: string | null;
          name?: string;
          progression?: string | null;
          regression?: string | null;
          repetitions?: string | null;
          sets?: string | null;
          target_muscle?: string | null;
          updated_at?: string;
          video_url?: string | null;
        };
        Relationships: [];
      };

      clinic_departments: {
        Row: {
          id: string;
          name: string;
          is_active: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          is_active?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          is_active?: boolean | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      clinic_partnerships: {
        Row: {
          id: string;
          name: string;
          type: string;
          value: number | null;
          fraction_numerator: number | null;
          fraction_denominator: number | null;
          is_active: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          type: string;
          value?: number | null;
          fraction_numerator?: number | null;
          fraction_denominator?: number | null;
          is_active?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          type?: string;
          value?: number | null;
          fraction_numerator?: number | null;
          fraction_denominator?: number | null;
          is_active?: boolean | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      clinic_settings: {
        Row: {
          key: string;
          value: Json;
        };
        Insert: {
          key: string;
          value: Json;
        };
        Update: {
          key?: string;
          value?: Json;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          discount: number;
          id: string;
          invoice_number: string;
          issue_date: string;
          patient_id: string;
          sessions_count: number | null;
          status: string;
          subtotal: number;
          total: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          discount?: number;
          id?: string;
          invoice_number?: string;
          issue_date?: string;
          patient_id: string;
          sessions_count?: number | null;
          status?: string;
          subtotal?: number;
          total?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          discount?: number;
          id?: string;
          invoice_number?: string;
          issue_date?: string;
          patient_id?: string;
          sessions_count?: number | null;
          status?: string;
          subtotal?: number;
          total?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      measurements: {
        Row: {
          created_at: string;
          id: string;
          measured_on: string;
          metric: string;
          patient_id: string;
          recorded_by: string | null;
          session_id: string | null;
          unit: string | null;
          value: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          measured_on?: string;
          metric: string;
          patient_id: string;
          recorded_by?: string | null;
          session_id?: string | null;
          unit?: string | null;
          value: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          measured_on?: string;
          metric?: string;
          patient_id?: string;
          recorded_by?: string | null;
          session_id?: string | null;
          unit?: string | null;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "measurements_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "measurements_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "treatment_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          due_at: string | null;
          id: string;
          is_read: boolean;
          patient_id: string | null;
          title: string;
          type: string;
          user_id: string | null;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          due_at?: string | null;
          id?: string;
          is_read?: boolean;
          patient_id?: string | null;
          title: string;
          type: string;
          user_id?: string | null;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          due_at?: string | null;
          id?: string;
          is_read?: boolean;
          patient_id?: string | null;
          title?: string;
          type?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      patient_assessment_answers: {
        Row: {
          assessment_id: string;
          created_at: string;
          id: string;
          option_id: string | null;
          question_id: string;
          score: number;
        };
        Insert: {
          assessment_id: string;
          created_at?: string;
          id?: string;
          option_id?: string | null;
          question_id: string;
          score?: number;
        };
        Update: {
          assessment_id?: string;
          created_at?: string;
          id?: string;
          option_id?: string | null;
          question_id?: string;
          score?: number;
        };
        Relationships: [
          {
            foreignKeyName: "patient_assessment_answers_assessment_id_fkey";
            columns: ["assessment_id"];
            isOneToOne: false;
            referencedRelation: "patient_assessments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "patient_assessment_answers_option_id_fkey";
            columns: ["option_id"];
            isOneToOne: false;
            referencedRelation: "questionnaire_options";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "patient_assessment_answers_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questionnaire_questions";
            referencedColumns: ["id"];
          },
        ];
      };
      patient_assessments: {
        Row: {
          assessed_by: string | null;
          assessed_on: string;
          created_at: string;
          final_score: number;
          id: string;
          interpretation: string | null;
          max_possible: number | null;
          notes: string | null;
          patient_id: string;
          questionnaire_id: string;
          raw_score: number;
          session_id: string | null;
          session_number: number | null;
          updated_at: string;
        };
        Insert: {
          assessed_by?: string | null;
          assessed_on?: string;
          created_at?: string;
          final_score?: number;
          id?: string;
          interpretation?: string | null;
          max_possible?: number | null;
          notes?: string | null;
          patient_id: string;
          questionnaire_id: string;
          raw_score?: number;
          session_id?: string | null;
          session_number?: number | null;
          updated_at?: string;
        };
        Update: {
          assessed_by?: string | null;
          assessed_on?: string;
          created_at?: string;
          final_score?: number;
          id?: string;
          interpretation?: string | null;
          max_possible?: number | null;
          notes?: string | null;
          patient_id?: string;
          questionnaire_id?: string;
          raw_score?: number;
          session_id?: string | null;
          session_number?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "patient_assessments_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "patient_assessments_questionnaire_id_fkey";
            columns: ["questionnaire_id"];
            isOneToOne: false;
            referencedRelation: "questionnaires";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "patient_assessments_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "treatment_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      patient_exercises: {
        Row: {
          assigned_by: string | null;
          created_at: string;
          exercise_id: string | null;
          frequency: string | null;
          id: string;
          notes: string | null;
          patient_id: string;
          repetitions: string | null;
          sets: string | null;
          updated_at: string;
        };
        Insert: {
          assigned_by?: string | null;
          created_at?: string;
          exercise_id?: string | null;
          frequency?: string | null;
          id?: string;
          notes?: string | null;
          patient_id: string;
          repetitions?: string | null;
          sets?: string | null;
          updated_at?: string;
        };
        Update: {
          assigned_by?: string | null;
          created_at?: string;
          exercise_id?: string | null;
          frequency?: string | null;
          id?: string;
          notes?: string | null;
          patient_id?: string;
          repetitions?: string | null;
          sets?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "patient_exercises_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "patient_exercises_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      patient_files: {
        Row: {
          category: string;
          created_at: string;
          drive_file_id: string | null;
          drive_web_view_link: string | null;
          file_name: string;
          id: string;
          mime_type: string | null;
          patient_id: string;
          size_bytes: number | null;
          storage_account_id: string | null;
          uploaded_by: string | null;
        };
        Insert: {
          category?: string;
          created_at?: string;
          drive_file_id?: string | null;
          drive_web_view_link?: string | null;
          file_name: string;
          id?: string;
          mime_type?: string | null;
          patient_id: string;
          size_bytes?: number | null;
          storage_account_id?: string | null;
          uploaded_by?: string | null;
        };
        Update: {
          category?: string;
          created_at?: string;
          drive_file_id?: string | null;
          drive_web_view_link?: string | null;
          file_name?: string;
          id?: string;
          mime_type?: string | null;
          patient_id?: string;
          size_bytes?: number | null;
          storage_account_id?: string | null;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "patient_files_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      patient_records: {
        Row: {
          created_at: string;
          id: string;
          label: string;
          module: string;
          patient_id: string;
          recorded_by: string | null;
          session_id: string | null;
          sort_order: number;
          updated_at: string;
          value: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          label: string;
          module: string;
          patient_id: string;
          recorded_by?: string | null;
          session_id?: string | null;
          sort_order?: number;
          updated_at?: string;
          value?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          label?: string;
          module?: string;
          patient_id?: string;
          recorded_by?: string | null;
          session_id?: string | null;
          sort_order?: number;
          updated_at?: string;
          value?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "patient_records_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      patients: {
        Row: {
          address: string | null;
          age: number | null;
          code: string;
          created_at: string;
          created_by: string | null;
          date_of_birth: string | null;
          deleted_at: string | null;
          diagnosis: string | null;
          email: string | null;
          extra: Json;
          full_name: string;
          gender: string | null;
          id: string;
          marital_status: string | null;
          notes: string | null;
          occupation: string | null;
          phone: string | null;
          phone_alt: string | null;
          primary_;
          referral_source: string | null;
          referral_phone: string | null;
          referral_address: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          age?: number | null;
          code?: string;
          created_at?: string;
          created_by?: string | null;
          date_of_birth?: string | null;
          deleted_at?: string | null;
          diagnosis?: string | null;
          email?: string | null;
          extra?: Json;
          full_name: string;
          gender?: string | null;
          id?: string;
          marital_status?: string | null;
          notes?: string | null;
          occupation?: string | null;
          phone?: string | null;
          phone_alt?: string | null;
          primary_;
          referral_source?: string | null;
          referral_phone?: string | null;
          referral_address?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          age?: number | null;
          code?: string;
          created_at?: string;
          created_by?: string | null;
          date_of_birth?: string | null;
          deleted_at?: string | null;
          diagnosis?: string | null;
          email?: string | null;
          extra?: Json;
          full_name?: string;
          gender?: string | null;
          id?: string;
          marital_status?: string | null;
          notes?: string | null;
          occupation?: string | null;
          phone?: string | null;
          phone_alt?: string | null;
          primary_;
          referral_source?: string | null;
          referral_phone?: string | null;
          referral_address?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          invoice_id: string | null;
          is_refund: boolean;
          method: string;
          note: string | null;
          paid_on: string;
          patient_id: string;
          received_by: string | null;
        };
        Insert: {
          amount: number;
          created_at?: string;
          id?: string;
          invoice_id?: string | null;
          is_refund?: boolean;
          method?: string;
          note?: string | null;
          paid_on?: string;
          patient_id: string;
          received_by?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          invoice_id?: string | null;
          is_refund?: boolean;
          method?: string;
          note?: string | null;
          paid_on?: string;
          patient_id?: string;
          received_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          is_active: boolean;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id: string;
          is_active?: boolean;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      questionnaire_options: {
        Row: {
          created_at: string;
          id: string;
          label: string;
          label_ar: string | null;
          question_id: string;
          score: number;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          label: string;
          label_ar?: string | null;
          question_id: string;
          score?: number;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          label?: string;
          label_ar?: string | null;
          question_id?: string;
          score?: number;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "questionnaire_options_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questionnaire_questions";
            referencedColumns: ["id"];
          },
        ];
      };
      questionnaire_questions: {
        Row: {
          created_at: string;
          id: string;
          questionnaire_id: string;
          sort_order: number;
          text: string;
          text_ar: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          questionnaire_id: string;
          sort_order?: number;
          text: string;
          text_ar?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          questionnaire_id?: string;
          sort_order?: number;
          text?: string;
          text_ar?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "questionnaire_questions_questionnaire_id_fkey";
            columns: ["questionnaire_id"];
            isOneToOne: false;
            referencedRelation: "questionnaires";
            referencedColumns: ["id"];
          },
        ];
      };
      questionnaires: {
        Row: {
          category: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          interpretation: Json;
          is_active: boolean;
          max_score: number | null;
          mcid: number | null;
          mdc: number | null;
          min_score: number;
          name: string;
          name_ar: string | null;
          scoring_formula: string | null;
          scoring_method: string;
          updated_at: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          interpretation?: Json;
          is_active?: boolean;
          max_score?: number | null;
          mcid?: number | null;
          mdc?: number | null;
          min_score?: number;
          name: string;
          name_ar?: string | null;
          scoring_formula?: string | null;
          scoring_method?: string;
          updated_at?: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          interpretation?: Json;
          is_active?: boolean;
          max_score?: number | null;
          mcid?: number | null;
          mdc?: number | null;
          min_score?: number;
          name?: string;
          name_ar?: string | null;
          scoring_formula?: string | null;
          scoring_method?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      storage_accounts: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          is_active: boolean;
          is_primary: boolean;
          label: string | null;
          root_folder_id: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          is_active?: boolean;
          is_primary?: boolean;
          label?: string | null;
          root_folder_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          is_active?: boolean;
          is_primary?: boolean;
          label?: string | null;
          root_folder_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      treatment_sessions: {
        Row: {
          assessment: string | null;
          attendance: string;
          compliance: string | null;
          complications: string | null;
          created_at: string;
          duration_minutes: number | null;
          id: string;
          next_session_plan: string | null;
          objective: string | null;
          pain_after: number | null;
          pain_before: number | null;
          patient_id: string;
          plan: string | null;
          response: string | null;
          session_date: string;
          session_number: number;
          signature: string | null;
          subjective: string | null;
          updated_at: string;
        };
        Insert: {
          assessment?: string | null;
          attendance?: string;
          compliance?: string | null;
          complications?: string | null;
          created_at?: string;
          duration_minutes?: number | null;
          id?: string;
          next_session_plan?: string | null;
          objective?: string | null;
          pain_after?: number | null;
          pain_before?: number | null;
          patient_id: string;
          plan?: string | null;
          response?: string | null;
          session_date?: string;
          session_number?: number;
          signature?: string | null;
          subjective?: string | null;
          updated_at?: string;
        };
        Update: {
          assessment?: string | null;
          attendance?: string;
          compliance?: string | null;
          complications?: string | null;
          created_at?: string;
          duration_minutes?: number | null;
          id?: string;
          next_session_plan?: string | null;
          objective?: string | null;
          pain_after?: number | null;
          pain_before?: number | null;
          patient_id?: string;
          plan?: string | null;
          response?: string | null;
          session_date?: string;
          session_number?: number;
          signature?: string | null;
          subjective?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "treatment_sessions_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      user_page_permissions: {
        Row: {
          allowed: boolean;
          created_at: string;
          id: string;
          page: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          allowed?: boolean;
          created_at?: string;
          id?: string;
          page: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          allowed?: boolean;
          created_at?: string;
          id?: string;
          page?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_edit_clinical: { Args: { _user_id: string }; Returns: boolean };
      delete_patient_completely: { Args: { p_id: string }; Returns: undefined };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_staff: { Args: { _user_id: string }; Returns: boolean };
    };
    Enums: {
      app_role: "super_admin" | "therapist" | "receptionist" | "assistant" | "trainee";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "therapist", "receptionist", "assistant", "trainee"],
    },
  },
} as const;
