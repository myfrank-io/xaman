export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      attachments: {
        Row: {
          boat_id: string
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["attachment_entity"]
          file_name: string
          id: string
          mime_type: string
          size_bytes: number
          storage_path: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          boat_id: string
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["attachment_entity"]
          file_name: string
          id?: string
          mime_type: string
          size_bytes: number
          storage_path: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          boat_id?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["attachment_entity"]
          file_name?: string
          id?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boat_dashboard_stats"
            referencedColumns: ["boat_id"]
          },
          {
            foreignKeyName: "attachments_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      boat_categories: {
        Row: {
          boat_id: string
          color: string
          created_at: string
          created_by: string | null
          external_ref: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          template_category_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          boat_id: string
          color: string
          created_at?: string
          created_by?: string | null
          external_ref?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          template_category_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          boat_id?: string
          color?: string
          created_at?: string
          created_by?: string | null
          external_ref?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          template_category_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "boat_categories_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boat_dashboard_stats"
            referencedColumns: ["boat_id"]
          },
          {
            foreignKeyName: "boat_categories_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boat_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boat_categories_template_category_id_fkey"
            columns: ["template_category_id"]
            isOneToOne: false
            referencedRelation: "checklist_template_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boat_categories_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      boat_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          boat_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["boat_role"]
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          boat_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role: Database["public"]["Enums"]["boat_role"]
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          boat_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["boat_role"]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "boat_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boat_invitations_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boat_dashboard_stats"
            referencedColumns: ["boat_id"]
          },
          {
            foreignKeyName: "boat_invitations_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boat_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      boat_members: {
        Row: {
          boat_id: string
          created_at: string
          invited_by: string | null
          role: Database["public"]["Enums"]["boat_role"]
          updated_at: string
          user_id: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          boat_id: string
          created_at?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["boat_role"]
          updated_at?: string
          user_id: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          boat_id?: string
          created_at?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["boat_role"]
          updated_at?: string
          user_id?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "boat_members_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boat_dashboard_stats"
            referencedColumns: ["boat_id"]
          },
          {
            foreignKeyName: "boat_members_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boat_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boat_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      boats: {
        Row: {
          beam_m: number | null
          builder: string | null
          checklist_template_id: string | null
          created_at: string
          created_by: string | null
          draft_m: number | null
          external_ref: string | null
          flag: string | null
          home_port: string | null
          hull_number: string | null
          id: string
          length_m: number | null
          model: string | null
          name: string
          notes: string | null
          organization_id: string | null
          photo_path: string | null
          sail_number: string | null
          type: Database["public"]["Enums"]["boat_type"]
          updated_at: string
          updated_by: string | null
          year: number | null
        }
        Insert: {
          beam_m?: number | null
          builder?: string | null
          checklist_template_id?: string | null
          created_at?: string
          created_by?: string | null
          draft_m?: number | null
          external_ref?: string | null
          flag?: string | null
          home_port?: string | null
          hull_number?: string | null
          id?: string
          length_m?: number | null
          model?: string | null
          name: string
          notes?: string | null
          organization_id?: string | null
          photo_path?: string | null
          sail_number?: string | null
          type?: Database["public"]["Enums"]["boat_type"]
          updated_at?: string
          updated_by?: string | null
          year?: number | null
        }
        Update: {
          beam_m?: number | null
          builder?: string | null
          checklist_template_id?: string | null
          created_at?: string
          created_by?: string | null
          draft_m?: number | null
          external_ref?: string | null
          flag?: string | null
          home_port?: string | null
          hull_number?: string | null
          id?: string
          length_m?: number | null
          model?: string | null
          name?: string
          notes?: string | null
          organization_id?: string | null
          photo_path?: string | null
          sail_number?: string | null
          type?: Database["public"]["Enums"]["boat_type"]
          updated_at?: string
          updated_by?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "boats_checklist_template_id_fkey"
            columns: ["checklist_template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boats_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boats_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boats_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_completions: {
        Row: {
          boat_id: string
          checklist_item_id: string
          completed_at: string
          completed_by: string | null
          completed_by_name: string | null
          created_at: string
          created_by: string | null
          engine_hours: number | null
          id: string
          maintenance_log_id: string | null
          note: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          boat_id: string
          checklist_item_id: string
          completed_at?: string
          completed_by?: string | null
          completed_by_name?: string | null
          created_at?: string
          created_by?: string | null
          engine_hours?: number | null
          id?: string
          maintenance_log_id?: string | null
          note?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          boat_id?: string
          checklist_item_id?: string
          completed_at?: string
          completed_by?: string | null
          completed_by_name?: string | null
          created_at?: string
          created_by?: string | null
          engine_hours?: number | null
          id?: string
          maintenance_log_id?: string | null
          note?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_completions_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boat_dashboard_stats"
            referencedColumns: ["boat_id"]
          },
          {
            foreignKeyName: "checklist_completions_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_completions_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_item_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_completions_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_completions_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_completions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_completions_maintenance_log_id_fkey"
            columns: ["maintenance_log_id"]
            isOneToOne: false
            referencedRelation: "maintenance_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_completions_maintenance_log_id_fkey"
            columns: ["maintenance_log_id"]
            isOneToOne: false
            referencedRelation: "maintenance_logs_trash_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_completions_maintenance_log_id_fkey"
            columns: ["maintenance_log_id"]
            isOneToOne: false
            referencedRelation: "maintenance_logs_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_completions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          actions: NonNullable<Json>
          boat_id: string
          category_id: string
          created_at: string
          created_by: string | null
          description: string | null
          engine_id: string | null
          external_ref: string | null
          id: string
          interval_hours: number | null
          interval_months: number | null
          is_active: boolean
          label: string
          sort_order: number
          source: Database["public"]["Enums"]["checklist_item_source"]
          template_item_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          actions?: NonNullable<Json>
          boat_id: string
          category_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          engine_id?: string | null
          external_ref?: string | null
          id?: string
          interval_hours?: number | null
          interval_months?: number | null
          is_active?: boolean
          label: string
          sort_order?: number
          source?: Database["public"]["Enums"]["checklist_item_source"]
          template_item_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          actions?: NonNullable<Json>
          boat_id?: string
          category_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          engine_id?: string | null
          external_ref?: string | null
          id?: string
          interval_hours?: number | null
          interval_months?: number | null
          is_active?: boolean
          label?: string
          sort_order?: number
          source?: Database["public"]["Enums"]["checklist_item_source"]
          template_item_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boat_dashboard_stats"
            referencedColumns: ["boat_id"]
          },
          {
            foreignKeyName: "checklist_items_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "boat_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "checklist_category_progress"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "checklist_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_engine_id_fkey"
            columns: ["engine_id"]
            isOneToOne: false
            referencedRelation: "engines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_template_item_id_fkey"
            columns: ["template_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_template_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_template_categories: {
        Row: {
          color: string
          created_at: string
          external_ref: string | null
          icon: string | null
          id: string
          name: string
          sort_order: number
          template_id: string
          updated_at: string
        }
        Insert: {
          color: string
          created_at?: string
          external_ref?: string | null
          icon?: string | null
          id?: string
          name: string
          sort_order?: number
          template_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          external_ref?: string | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_categories_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_template_items: {
        Row: {
          actions: NonNullable<Json>
          created_at: string
          description: string | null
          engine_scope: string
          external_ref: string | null
          id: string
          interval_hours: number | null
          interval_months: number | null
          label: string
          sort_order: number
          source: string | null
          template_category_id: string
          updated_at: string
        }
        Insert: {
          actions?: NonNullable<Json>
          created_at?: string
          description?: string | null
          engine_scope?: string
          external_ref?: string | null
          id?: string
          interval_hours?: number | null
          interval_months?: number | null
          label: string
          sort_order?: number
          source?: string | null
          template_category_id: string
          updated_at?: string
        }
        Update: {
          actions?: NonNullable<Json>
          created_at?: string
          description?: string | null
          engine_scope?: string
          external_ref?: string | null
          id?: string
          interval_hours?: number | null
          interval_months?: number | null
          label?: string
          sort_order?: number
          source?: string | null
          template_category_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_items_template_category_id_fkey"
            columns: ["template_category_id"]
            isOneToOne: false
            referencedRelation: "checklist_template_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          boat_type: Database["public"]["Enums"]["boat_type"] | null
          builder: string | null
          created_at: string
          created_by: string | null
          external_ref: string | null
          id: string
          is_public: boolean
          model: string | null
          name: string
          owner_organization_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          boat_type?: Database["public"]["Enums"]["boat_type"] | null
          builder?: string | null
          created_at?: string
          created_by?: string | null
          external_ref?: string | null
          id?: string
          is_public?: boolean
          model?: string | null
          name: string
          owner_organization_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          boat_type?: Database["public"]["Enums"]["boat_type"] | null
          builder?: string | null
          created_at?: string
          created_by?: string | null
          external_ref?: string | null
          id?: string
          is_public?: boolean
          model?: string | null
          name?: string
          owner_organization_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_templates_owner_organization_id_fkey"
            columns: ["owner_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          boat_id: string
          company: string | null
          created_at: string
          created_by: string | null
          email: string | null
          external_ref: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          specialty: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          boat_id: string
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          external_ref?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          specialty: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          boat_id?: string
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          external_ref?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          specialty?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boat_dashboard_stats"
            referencedColumns: ["boat_id"]
          },
          {
            foreignKeyName: "contacts_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      engine_hour_readings: {
        Row: {
          boat_id: string
          checklist_completion_id: string | null
          created_at: string
          created_by: string | null
          engine_id: string
          hours: number
          id: string
          maintenance_log_id: string | null
          note: string | null
          read_at: string
          source: Database["public"]["Enums"]["hour_reading_source"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          boat_id: string
          checklist_completion_id?: string | null
          created_at?: string
          created_by?: string | null
          engine_id: string
          hours: number
          id?: string
          maintenance_log_id?: string | null
          note?: string | null
          read_at?: string
          source?: Database["public"]["Enums"]["hour_reading_source"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          boat_id?: string
          checklist_completion_id?: string | null
          created_at?: string
          created_by?: string | null
          engine_id?: string
          hours?: number
          id?: string
          maintenance_log_id?: string | null
          note?: string | null
          read_at?: string
          source?: Database["public"]["Enums"]["hour_reading_source"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engine_hour_readings_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boat_dashboard_stats"
            referencedColumns: ["boat_id"]
          },
          {
            foreignKeyName: "engine_hour_readings_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engine_hour_readings_checklist_completion_id_fkey"
            columns: ["checklist_completion_id"]
            isOneToOne: true
            referencedRelation: "checklist_completions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engine_hour_readings_checklist_completion_id_fkey"
            columns: ["checklist_completion_id"]
            isOneToOne: true
            referencedRelation: "checklist_item_status"
            referencedColumns: ["last_completion_id"]
          },
          {
            foreignKeyName: "engine_hour_readings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engine_hour_readings_engine_id_fkey"
            columns: ["engine_id"]
            isOneToOne: false
            referencedRelation: "engines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engine_hour_readings_maintenance_log_id_fkey"
            columns: ["maintenance_log_id"]
            isOneToOne: false
            referencedRelation: "maintenance_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engine_hour_readings_maintenance_log_id_fkey"
            columns: ["maintenance_log_id"]
            isOneToOne: false
            referencedRelation: "maintenance_logs_trash_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engine_hour_readings_maintenance_log_id_fkey"
            columns: ["maintenance_log_id"]
            isOneToOne: false
            referencedRelation: "maintenance_logs_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engine_hour_readings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      engines: {
        Row: {
          boat_id: string
          brand: string | null
          created_at: string
          created_by: string | null
          external_ref: string | null
          id: string
          installed_at: string | null
          is_active: boolean
          label: string
          model: string | null
          notes: string | null
          position: Database["public"]["Enums"]["engine_position"]
          serial: string | null
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          boat_id: string
          brand?: string | null
          created_at?: string
          created_by?: string | null
          external_ref?: string | null
          id?: string
          installed_at?: string | null
          is_active?: boolean
          label: string
          model?: string | null
          notes?: string | null
          position: Database["public"]["Enums"]["engine_position"]
          serial?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          boat_id?: string
          brand?: string | null
          created_at?: string
          created_by?: string | null
          external_ref?: string | null
          id?: string
          installed_at?: string | null
          is_active?: boolean
          label?: string
          model?: string | null
          notes?: string | null
          position?: Database["public"]["Enums"]["engine_position"]
          serial?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engines_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boat_dashboard_stats"
            referencedColumns: ["boat_id"]
          },
          {
            foreignKeyName: "engines_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engines_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engines_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          boat_id: string
          brand: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          external_ref: string | null
          id: string
          installed_at: string | null
          model: string | null
          name: string
          notes: string | null
          quantity: number
          serial: string | null
          sort_order: number
          specs: NonNullable<Json>
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          boat_id: string
          brand?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          external_ref?: string | null
          id?: string
          installed_at?: string | null
          model?: string | null
          name: string
          notes?: string | null
          quantity?: number
          serial?: string | null
          sort_order?: number
          specs?: NonNullable<Json>
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          boat_id?: string
          brand?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          external_ref?: string | null
          id?: string
          installed_at?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          quantity?: number
          serial?: string | null
          sort_order?: number
          specs?: NonNullable<Json>
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boat_dashboard_stats"
            referencedColumns: ["boat_id"]
          },
          {
            foreignKeyName: "equipment_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "boat_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "checklist_category_progress"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "equipment_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      haul_outs: {
        Row: {
          boat_id: string
          cost: number | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          ended_at: string | null
          external_ref: string | null
          id: string
          notes: string | null
          started_at: string
          updated_at: string
          updated_by: string | null
          works: string | null
          yard_contact_id: string | null
          yard_name: string | null
        }
        Insert: {
          boat_id: string
          cost?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          ended_at?: string | null
          external_ref?: string | null
          id?: string
          notes?: string | null
          started_at: string
          updated_at?: string
          updated_by?: string | null
          works?: string | null
          yard_contact_id?: string | null
          yard_name?: string | null
        }
        Update: {
          boat_id?: string
          cost?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          ended_at?: string | null
          external_ref?: string | null
          id?: string
          notes?: string | null
          started_at?: string
          updated_at?: string
          updated_by?: string | null
          works?: string | null
          yard_contact_id?: string | null
          yard_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "haul_outs_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boat_dashboard_stats"
            referencedColumns: ["boat_id"]
          },
          {
            foreignKeyName: "haul_outs_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "haul_outs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "haul_outs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "haul_outs_yard_contact_id_fkey"
            columns: ["yard_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_logs: {
        Row: {
          boat_id: string
          category_id: string | null
          contact_id: string | null
          cost: number | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          external_ref: string | null
          haul_out_id: string | null
          id: string
          needs_review: boolean
          next_due_at: string | null
          notes: string | null
          pending_engine_hours: Json | null
          performed_at: string
          priority: Database["public"]["Enums"]["log_priority"]
          status: Database["public"]["Enums"]["log_status"]
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          boat_id: string
          category_id?: string | null
          contact_id?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          external_ref?: string | null
          haul_out_id?: string | null
          id?: string
          needs_review?: boolean
          next_due_at?: string | null
          notes?: string | null
          pending_engine_hours?: Json | null
          performed_at: string
          priority?: Database["public"]["Enums"]["log_priority"]
          status?: Database["public"]["Enums"]["log_status"]
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          boat_id?: string
          category_id?: string | null
          contact_id?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          external_ref?: string | null
          haul_out_id?: string | null
          id?: string
          needs_review?: boolean
          next_due_at?: string | null
          notes?: string | null
          pending_engine_hours?: Json | null
          performed_at?: string
          priority?: Database["public"]["Enums"]["log_priority"]
          status?: Database["public"]["Enums"]["log_status"]
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boat_dashboard_stats"
            referencedColumns: ["boat_id"]
          },
          {
            foreignKeyName: "maintenance_logs_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "boat_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "checklist_category_progress"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "maintenance_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_haul_out_id_fkey"
            columns: ["haul_out_id"]
            isOneToOne: false
            referencedRelation: "haul_outs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          organization_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          type: Database["public"]["Enums"]["organization_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          type?: Database["public"]["Enums"]["organization_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["organization_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parts: {
        Row: {
          boat_id: string
          category_id: string | null
          created_at: string
          created_by: string | null
          external_ref: string | null
          id: string
          location: string | null
          min_quantity: number
          name: string
          notes: string | null
          quantity: number
          reference: string | null
          supplier_contact_id: string | null
          unit: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          boat_id: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          external_ref?: string | null
          id?: string
          location?: string | null
          min_quantity?: number
          name: string
          notes?: string | null
          quantity?: number
          reference?: string | null
          supplier_contact_id?: string | null
          unit?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          boat_id?: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          external_ref?: string | null
          id?: string
          location?: string | null
          min_quantity?: number
          name?: string
          notes?: string | null
          quantity?: number
          reference?: string | null
          supplier_contact_id?: string | null
          unit?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parts_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boat_dashboard_stats"
            referencedColumns: ["boat_id"]
          },
          {
            foreignKeyName: "parts_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "boat_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "checklist_category_progress"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "parts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_supplier_contact_id_fkey"
            columns: ["supplier_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_platform_admin: boolean
          locale: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_platform_admin?: boolean
          locale?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_platform_admin?: boolean
          locale?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount: number | null
          boat_id: string
          bottle_type: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          designation: string
          external_ref: string | null
          id: string
          kind: Database["public"]["Enums"]["purchase_kind"]
          maintenance_log_id: string | null
          needs_review: boolean
          notes: string | null
          part_id: string | null
          purchased_at: string
          quantity: number
          supplier_contact_id: string | null
          supplier_name: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount?: number | null
          boat_id: string
          bottle_type?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          designation: string
          external_ref?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["purchase_kind"]
          maintenance_log_id?: string | null
          needs_review?: boolean
          notes?: string | null
          part_id?: string | null
          purchased_at: string
          quantity?: number
          supplier_contact_id?: string | null
          supplier_name?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number | null
          boat_id?: string
          bottle_type?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          designation?: string
          external_ref?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["purchase_kind"]
          maintenance_log_id?: string | null
          needs_review?: boolean
          notes?: string | null
          part_id?: string | null
          purchased_at?: string
          quantity?: number
          supplier_contact_id?: string | null
          supplier_name?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boat_dashboard_stats"
            referencedColumns: ["boat_id"]
          },
          {
            foreignKeyName: "purchases_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "boat_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "checklist_category_progress"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "purchases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_maintenance_log_id_fkey"
            columns: ["maintenance_log_id"]
            isOneToOne: false
            referencedRelation: "maintenance_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_maintenance_log_id_fkey"
            columns: ["maintenance_log_id"]
            isOneToOne: false
            referencedRelation: "maintenance_logs_trash_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_maintenance_log_id_fkey"
            columns: ["maintenance_log_id"]
            isOneToOne: false
            referencedRelation: "maintenance_logs_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_contact_id_fkey"
            columns: ["supplier_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      boat_dashboard_stats: {
        Row: {
          boat_id: string | null
          in_progress_logs: number | null
          last_haul_out_at: string | null
          low_stock_parts: number | null
          months_since_haul_out: number | null
          overdue_items: number | null
          planned_logs: number | null
          soon_items: number | null
          urgent_logs: number | null
          ytd_expenses: number | null
        }
        Insert: {
          boat_id?: string | null
          in_progress_logs?: never
          last_haul_out_at?: never
          low_stock_parts?: never
          months_since_haul_out?: never
          overdue_items?: never
          planned_logs?: never
          soon_items?: never
          urgent_logs?: never
          ytd_expenses?: never
        }
        Update: {
          boat_id?: string | null
          in_progress_logs?: never
          last_haul_out_at?: never
          low_stock_parts?: never
          months_since_haul_out?: never
          overdue_items?: never
          planned_logs?: never
          soon_items?: never
          urgent_logs?: never
          ytd_expenses?: never
        }
        Relationships: []
      }
      boat_invitations_safe: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          boat_id: string | null
          created_at: string | null
          email: string | null
          expires_at: string | null
          id: string | null
          invited_by: string | null
          invited_by_name: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["boat_role"] | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "boat_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boat_invitations_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boat_dashboard_stats"
            referencedColumns: ["boat_id"]
          },
          {
            foreignKeyName: "boat_invitations_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boat_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_category_progress: {
        Row: {
          boat_id: string | null
          category_id: string | null
          color: string | null
          icon: string | null
          name: string | null
          never_count: number | null
          ok_count: number | null
          overdue_count: number | null
          progress: number | null
          soon_count: number | null
          sort_order: number | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "boat_categories_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boat_dashboard_stats"
            referencedColumns: ["boat_id"]
          },
          {
            foreignKeyName: "boat_categories_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_item_status: {
        Row: {
          actions: Json | null
          boat_id: string | null
          category_id: string | null
          current_hours: number | null
          days_remaining: number | null
          description: string | null
          due_at: string | null
          due_hours: number | null
          engine_id: string | null
          hours_remaining: number | null
          id: string | null
          interval_hours: number | null
          interval_months: number | null
          label: string | null
          last_completed_at: string | null
          last_completed_by: string | null
          last_completed_by_name: string | null
          last_completion_id: string | null
          last_engine_hours: number | null
          last_note: string | null
          sort_order: number | null
          source: Database["public"]["Enums"]["checklist_item_source"] | null
          status: Database["public"]["Enums"]["checklist_state"] | null
          template_item_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_completions_completed_by_fkey"
            columns: ["last_completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boat_dashboard_stats"
            referencedColumns: ["boat_id"]
          },
          {
            foreignKeyName: "checklist_items_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "boat_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "checklist_category_progress"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "checklist_items_engine_id_fkey"
            columns: ["engine_id"]
            isOneToOne: false
            referencedRelation: "engines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_template_item_id_fkey"
            columns: ["template_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_template_items"
            referencedColumns: ["id"]
          },
        ]
      }
      engine_current_hours: {
        Row: {
          boat_id: string | null
          engine_id: string | null
          hours: number | null
          read_at: string | null
          reading_id: string | null
          source: Database["public"]["Enums"]["hour_reading_source"] | null
        }
        Relationships: [
          {
            foreignKeyName: "engine_hour_readings_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boat_dashboard_stats"
            referencedColumns: ["boat_id"]
          },
          {
            foreignKeyName: "engine_hour_readings_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engine_hour_readings_engine_id_fkey"
            columns: ["engine_id"]
            isOneToOne: false
            referencedRelation: "engines"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses_by_category: {
        Row: {
          amount: number | null
          boat_id: string | null
          category_color: string | null
          category_id: string | null
          category_name: string | null
          currency: string | null
          date: string | null
          entity_id: string | null
          label: string | null
          purchase_kind: Database["public"]["Enums"]["purchase_kind"] | null
          source: string | null
        }
        Relationships: []
      }
      maintenance_logs_trash_view: {
        Row: {
          boat_id: string | null
          category_color: string | null
          category_id: string | null
          category_name: string | null
          cost: number | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_by_name: string | null
          id: string | null
          performed_at: string | null
          status: Database["public"]["Enums"]["log_status"] | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boat_dashboard_stats"
            referencedColumns: ["boat_id"]
          },
          {
            foreignKeyName: "maintenance_logs_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "boat_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "checklist_category_progress"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "maintenance_logs_updated_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_logs_view: {
        Row: {
          attachments_count: number | null
          boat_id: string | null
          category_color: string | null
          category_id: string | null
          category_is_active: boolean | null
          category_name: string | null
          completions_count: number | null
          contact_id: string | null
          contact_name: string | null
          cost: number | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          currency: string | null
          engine_hours: Json | null
          external_ref: string | null
          haul_out_id: string | null
          id: string | null
          needs_review: boolean | null
          next_due_at: string | null
          notes: string | null
          pending_engine_hours: Json | null
          performed_at: string | null
          priority: Database["public"]["Enums"]["log_priority"] | null
          purchases_count: number | null
          status: Database["public"]["Enums"]["log_status"] | null
          title: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boat_dashboard_stats"
            referencedColumns: ["boat_id"]
          },
          {
            foreignKeyName: "maintenance_logs_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "boat_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "checklist_category_progress"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "maintenance_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_haul_out_id_fkey"
            columns: ["haul_out_id"]
            isOneToOne: false
            referencedRelation: "haul_outs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string }
      apply_checklist_template: {
        Args: { p_boat_id: string; p_engine_id?: string; p_template_id: string }
        Returns: undefined
      }
      boat_id_from_storage_path: { Args: { p_name: string }; Returns: string }
      boat_role: {
        Args: { p_boat_id: string }
        Returns: Database["public"]["Enums"]["boat_role"]
      }
      can_contribute_boat: { Args: { p_boat_id: string }; Returns: boolean }
      can_write_boat: { Args: { p_boat_id: string }; Returns: boolean }
      checklist_compute_status: {
        Args: {
          p_current_hours: number
          p_interval_hours: number
          p_interval_months: number
          p_last_completed_at: string
          p_last_engine_hours: number
          p_today?: string
        }
        Returns: Record<string, unknown>
      }
      get_invitation_preview: {
        Args: { p_token: string }
        Returns: {
          boat_name: string
          email: string
          inviter_name: string
          role: Database["public"]["Enums"]["boat_role"]
          status: string
        }[]
      }
      is_boat_member: { Args: { p_boat_id: string }; Returns: boolean }
      is_boat_owner: { Args: { p_boat_id: string }; Returns: boolean }
      is_platform_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      mark_log_reviewed: {
        Args: { p_hours_override?: Json; p_log_id: string }
        Returns: undefined
      }
      purge_trash: { Args: Record<PropertyKey, never>; Returns: number }
      shares_boat_with: { Args: { p_user_id: string }; Returns: boolean }
    }
    Enums: {
      attachment_entity:
        | "maintenance_log"
        | "equipment"
        | "haul_out"
        | "purchase"
        | "boat"
        | "checklist_completion"
      boat_role: "owner" | "editor" | "pro" | "viewer" | "renter"
      boat_type:
        | "catamaran"
        | "trimaran"
        | "monohull_sail"
        | "motor"
        | "rib"
        | "other"
      checklist_item_source: "template" | "custom"
      checklist_state: "never" | "ok" | "soon" | "overdue"
      engine_position: "port" | "starboard" | "center" | "outboard"
      hour_reading_source: "manual" | "maintenance_log" | "checklist" | "import"
      log_priority: "low" | "normal" | "high"
      log_status: "planned" | "in_progress" | "done" | "urgent"
      organization_type:
        | "private"
        | "charter"
        | "club"
        | "builder"
        | "yard"
        | "pro"
      purchase_kind: "gas" | "part" | "consumable" | "service" | "other"
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
    Enums: {
      attachment_entity: [
        "maintenance_log",
        "equipment",
        "haul_out",
        "purchase",
        "boat",
        "checklist_completion",
      ],
      boat_role: ["owner", "editor", "pro", "viewer", "renter"],
      boat_type: [
        "catamaran",
        "trimaran",
        "monohull_sail",
        "motor",
        "rib",
        "other",
      ],
      checklist_item_source: ["template", "custom"],
      checklist_state: ["never", "ok", "soon", "overdue"],
      engine_position: ["port", "starboard", "center", "outboard"],
      hour_reading_source: ["manual", "maintenance_log", "checklist", "import"],
      log_priority: ["low", "normal", "high"],
      log_status: ["planned", "in_progress", "done", "urgent"],
      organization_type: [
        "private",
        "charter",
        "club",
        "builder",
        "yard",
        "pro",
      ],
      purchase_kind: ["gas", "part", "consumable", "service", "other"],
    },
  },
} as const
