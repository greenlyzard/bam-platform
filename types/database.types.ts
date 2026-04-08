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
      angelina_admin_consultations: {
        Row: {
          admin_id: string
          context_id: string | null
          context_type: string | null
          created_at: string
          id: string
          last_message_at: string
          messages: Json
          tenant_id: string
        }
        Insert: {
          admin_id: string
          context_id?: string | null
          context_type?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          messages?: Json
          tenant_id: string
        }
        Update: {
          admin_id?: string
          context_id?: string | null
          context_type?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          messages?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "angelina_admin_consultations_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "angelina_admin_consultations_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "angelina_admin_consultations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      angelina_conversations: {
        Row: {
          context_snapshot: Json | null
          created_at: string | null
          id: string
          lead_child_age: number | null
          lead_child_name: string | null
          lead_converted: boolean | null
          lead_email: string | null
          lead_name: string | null
          messages: Json
          role: string
          session_id: string
          tenant_id: string
          token_usage: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          context_snapshot?: Json | null
          created_at?: string | null
          id?: string
          lead_child_age?: number | null
          lead_child_name?: string | null
          lead_converted?: boolean | null
          lead_email?: string | null
          lead_name?: string | null
          messages?: Json
          role: string
          session_id: string
          tenant_id: string
          token_usage?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          context_snapshot?: Json | null
          created_at?: string | null
          id?: string
          lead_child_age?: number | null
          lead_child_name?: string | null
          lead_converted?: boolean | null
          lead_email?: string | null
          lead_name?: string | null
          messages?: Json
          role?: string
          session_id?: string
          tenant_id?: string
          token_usage?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "angelina_conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "angelina_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "angelina_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      angelina_feedback: {
        Row: {
          comment: string | null
          conversation_id: string
          created_at: string | null
          id: string
          message_index: number
          rating: string | null
          tenant_id: string
        }
        Insert: {
          comment?: string | null
          conversation_id: string
          created_at?: string | null
          id?: string
          message_index: number
          rating?: string | null
          tenant_id: string
        }
        Update: {
          comment?: string | null
          conversation_id?: string
          created_at?: string | null
          id?: string
          message_index?: number
          rating?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "angelina_feedback_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "angelina_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "angelina_feedback_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_recipients: {
        Row: {
          announcement_id: string
          email: string | null
          id: string
          profile_id: string
          read_at: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          announcement_id: string
          email?: string | null
          id?: string
          profile_id: string
          read_at?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          announcement_id?: string
          email?: string | null
          id?: string
          profile_id?: string
          read_at?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_recipients_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_recipients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_recipients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          audience: string
          audience_filter: Json | null
          body_html: string
          channel: string
          created_at: string
          created_by: string
          id: string
          recipient_count: number | null
          sender_name: string | null
          sent_at: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          audience: string
          audience_filter?: Json | null
          body_html: string
          channel?: string
          created_at?: string
          created_by: string
          id?: string
          recipient_count?: number | null
          sender_name?: string | null
          sent_at?: string | null
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          audience_filter?: Json | null
          body_html?: string
          channel?: string
          created_at?: string
          created_by?: string
          id?: string
          recipient_count?: number | null
          sender_name?: string | null
          sent_at?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_tasks: {
        Row: {
          assigned_to: string
          change_request_id: string
          completed_at: string | null
          created_at: string
          id: string
          prompt_channel: string[] | null
          prompted_at: string | null
          reminder_count: number | null
          status: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_to: string
          change_request_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          prompt_channel?: string[] | null
          prompted_at?: string | null
          reminder_count?: number | null
          status?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string
          change_request_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          prompt_channel?: string[] | null
          prompted_at?: string | null
          reminder_count?: number | null
          status?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_tasks_change_request_id_fkey"
            columns: ["change_request_id"]
            isOneToOne: false
            referencedRelation: "schedule_change_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          class_date: string
          class_id: string
          created_at: string | null
          id: string
          recorded_by: string | null
          status: string
          student_id: string
          teacher_notes: string | null
        }
        Insert: {
          class_date: string
          class_id: string
          created_at?: string | null
          id?: string
          recorded_by?: string | null
          status?: string
          student_id: string
          teacher_notes?: string | null
        }
        Update: {
          class_date?: string
          class_id?: string
          created_at?: string | null
          id?: string
          recorded_by?: string | null
          status?: string
          student_id?: string
          teacher_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          class_id: string
          created_at: string
          date: string
          id: string
          notes: string | null
          status: string
          student_id: string
          teacher_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          status: string
          student_id: string
          teacher_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          status?: string
          student_id?: string
          teacher_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          active: boolean | null
          auto_award: boolean | null
          category: string
          created_at: string | null
          criteria: Json | null
          description: string | null
          icon_url: string | null
          id: string
          name: string
          slug: string | null
          tenant_id: string | null
          tier: string | null
        }
        Insert: {
          active?: boolean | null
          auto_award?: boolean | null
          category: string
          created_at?: string | null
          criteria?: Json | null
          description?: string | null
          icon_url?: string | null
          id?: string
          name: string
          slug?: string | null
          tenant_id?: string | null
          tier?: string | null
        }
        Update: {
          active?: boolean | null
          auto_award?: boolean | null
          category?: string
          created_at?: string | null
          criteria?: Json | null
          description?: string | null
          icon_url?: string | null
          id?: string
          name?: string
          slug?: string | null
          tenant_id?: string | null
          tier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "badges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_configs: {
        Row: {
          created_at: string | null
          description: string | null
          discount_type: string
          discount_value: number | null
          id: string
          is_active: boolean | null
          is_unlimited: boolean | null
          name: string
          sort_order: number | null
          tenant_id: string
          trigger_type: string
          trigger_value: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          discount_type: string
          discount_value?: number | null
          id?: string
          is_active?: boolean | null
          is_unlimited?: boolean | null
          name: string
          sort_order?: number | null
          tenant_id: string
          trigger_type: string
          trigger_value?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number | null
          id?: string
          is_active?: boolean | null
          is_unlimited?: boolean | null
          name?: string
          sort_order?: number | null
          tenant_id?: string
          trigger_type?: string
          trigger_value?: number | null
        }
        Relationships: []
      }
      calendar_subscriptions: {
        Row: {
          created_at: string
          id: string
          last_synced_at: string | null
          provider: string | null
          scope: Json
          subscription_token: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_synced_at?: string | null
          provider?: string | null
          scope: Json
          subscription_token: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_synced_at?: string | null
          provider?: string | null
          scope?: Json
          subscription_token?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      casting: {
        Row: {
          costume_assigned: boolean
          costume_notes: string | null
          created_at: string
          id: string
          is_alternate: boolean
          notes: string | null
          production_dance_id: string
          role: string
          student_id: string
        }
        Insert: {
          costume_assigned?: boolean
          costume_notes?: string | null
          created_at?: string
          id?: string
          is_alternate?: boolean
          notes?: string | null
          production_dance_id: string
          role?: string
          student_id: string
        }
        Update: {
          costume_assigned?: boolean
          costume_notes?: string | null
          created_at?: string
          id?: string
          is_alternate?: boolean
          notes?: string | null
          production_dance_id?: string
          role?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "casting_production_dance_id_fkey"
            columns: ["production_dance_id"]
            isOneToOne: false
            referencedRelation: "production_dances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "casting_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_members: {
        Row: {
          channel_id: string
          id: string
          is_muted: boolean
          joined_at: string
          last_read_at: string | null
          profile_id: string
          role: string
        }
        Insert: {
          channel_id: string
          id?: string
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string | null
          profile_id: string
          role?: string
        }
        Update: {
          channel_id?: string
          id?: string
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string | null
          profile_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_messages: {
        Row: {
          channel_id: string
          content: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          message_type: string
          reply_to_id: string | null
          search_vector: unknown
          sender_id: string | null
        }
        Insert: {
          channel_id: string
          content: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          message_type?: string
          reply_to_id?: string | null
          search_vector?: unknown
          sender_id?: string | null
        }
        Update: {
          channel_id?: string
          content?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          message_type?: string
          reply_to_id?: string | null
          search_vector?: unknown
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "channel_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_post_comments: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          post_id: string
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_post_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_post_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "channel_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_posts: {
        Row: {
          author_id: string | null
          body: string
          channel_id: string
          created_at: string
          deleted_at: string | null
          id: string
          is_announcement: boolean
          is_pinned: boolean
          search_vector: unknown
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          channel_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_announcement?: boolean
          is_pinned?: boolean
          search_vector?: unknown
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          channel_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_announcement?: boolean
          is_pinned?: boolean
          search_vector?: unknown
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_posts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          class_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          icon_url: string | null
          id: string
          is_archived: boolean
          last_message_at: string | null
          name: string
          pinned_post_id: string | null
          production_id: string | null
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon_url?: string | null
          id?: string
          is_archived?: boolean
          last_message_at?: string | null
          name: string
          pinned_post_id?: string | null
          production_id?: string | null
          tenant_id: string
          type: string
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon_url?: string | null
          id?: string
          is_archived?: boolean
          last_message_at?: string | null
          name?: string
          pinned_post_id?: string | null
          production_id?: string | null
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_production_id_fkey"
            columns: ["production_id"]
            isOneToOne: false
            referencedRelation: "productions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_channels_pinned_post"
            columns: ["pinned_post_id"]
            isOneToOne: false
            referencedRelation: "channel_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      class_field_config: {
        Row: {
          admin_default_on: boolean
          admin_visible: boolean
          adult_student_visible: boolean
          child_portal_visible: boolean
          created_at: string
          field_key: string
          field_type: string
          group_name: string | null
          id: string
          is_core: boolean
          label: string
          parent_visible: boolean
          public_visible: boolean
          sort_order: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admin_default_on?: boolean
          admin_visible?: boolean
          adult_student_visible?: boolean
          child_portal_visible?: boolean
          created_at?: string
          field_key: string
          field_type?: string
          group_name?: string | null
          id?: string
          is_core?: boolean
          label: string
          parent_visible?: boolean
          public_visible?: boolean
          sort_order?: number
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admin_default_on?: boolean
          admin_visible?: boolean
          adult_student_visible?: boolean
          child_portal_visible?: boolean
          created_at?: string
          field_key?: string
          field_type?: string
          group_name?: string | null
          id?: string
          is_core?: boolean
          label?: string
          parent_visible?: boolean
          public_visible?: boolean
          sort_order?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_field_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_field_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_field_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_notes: {
        Row: {
          class_id: string
          content: string
          created_at: string | null
          id: string
          is_private: boolean | null
          note_date: string
          note_type: string | null
          teacher_id: string
          tenant_id: string
        }
        Insert: {
          class_id: string
          content: string
          created_at?: string | null
          id?: string
          is_private?: boolean | null
          note_date?: string
          note_type?: string | null
          teacher_id: string
          tenant_id: string
        }
        Update: {
          class_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_private?: boolean | null
          note_date?: string
          note_type?: string | null
          teacher_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_notes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_notes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_notes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      class_phases: {
        Row: {
          class_id: string
          created_at: string | null
          end_date: string
          id: string
          notes: string | null
          phase: string
          production_id: string | null
          start_date: string
          tenant_id: string
        }
        Insert: {
          class_id: string
          created_at?: string | null
          end_date: string
          id?: string
          notes?: string | null
          phase: string
          production_id?: string | null
          start_date: string
          tenant_id: string
        }
        Update: {
          class_id?: string
          created_at?: string | null
          end_date?: string
          id?: string
          notes?: string | null
          phase?: string
          production_id?: string | null
          start_date?: string
          tenant_id?: string
        }
        Relationships: []
      }
      class_pricing_rules: {
        Row: {
          amount: number
          class_id: string
          created_at: string | null
          deadline: string | null
          discount_type: string | null
          discount_value: number | null
          id: string
          is_base_price: boolean | null
          label: string
          sort_order: number | null
          tenant_id: string
        }
        Insert: {
          amount: number
          class_id: string
          created_at?: string | null
          deadline?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          is_base_price?: boolean | null
          label: string
          sort_order?: number | null
          tenant_id: string
        }
        Update: {
          amount?: number
          class_id?: string
          created_at?: string | null
          deadline?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          is_base_price?: boolean | null
          label?: string
          sort_order?: number | null
          tenant_id?: string
        }
        Relationships: []
      }
      class_reminders: {
        Row: {
          class_id: string | null
          id: string
          recipient_count: number | null
          reminder_date: string
          schedule_instance_id: string
          sent_at: string
        }
        Insert: {
          class_id?: string | null
          id?: string
          recipient_count?: number | null
          reminder_date: string
          schedule_instance_id: string
          sent_at?: string
        }
        Update: {
          class_id?: string | null
          id?: string
          recipient_count?: number | null
          reminder_date?: string
          schedule_instance_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_reminders_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_reminders_schedule_instance_id_fkey"
            columns: ["schedule_instance_id"]
            isOneToOne: true
            referencedRelation: "schedule_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      class_teachers: {
        Row: {
          class_id: string
          created_at: string | null
          id: string
          is_primary: boolean | null
          role: string
          teacher_id: string
          tenant_id: string
        }
        Insert: {
          class_id: string
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          role?: string
          teacher_id: string
          tenant_id: string
        }
        Update: {
          class_id?: string
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          role?: string
          teacher_id?: string
          tenant_id?: string
        }
        Relationships: []
      }
      classes: {
        Row: {
          age_max: number | null
          age_min: number | null
          color_hex: string | null
          created_at: string | null
          curriculum_ids: string[] | null
          day_of_week: number | null
          days_of_week: number[] | null
          description: string | null
          discipline: string | null
          discipline_ids: string[] | null
          end_date: string | null
          end_time: string | null
          enrolled_count: number
          fee_cents: number | null
          gender: string | null
          id: string
          is_active: boolean | null
          is_hidden: boolean | null
          is_new: boolean | null
          is_performance: boolean | null
          is_rehearsal: boolean | null
          levels: string[] | null
          location_id: string | null
          long_description: string | null
          max_enrollment: number | null
          max_students: number | null
          medium_description: string | null
          name: string
          new_expires_at: string | null
          notes: string | null
          online_registration: boolean | null
          point_cost: number
          room: string | null
          room_id: string | null
          season: string | null
          season_id: string | null
          short_description: string | null
          show_capacity_public: boolean | null
          start_date: string | null
          start_time: string | null
          status: string
          style: string
          teacher_id: string | null
          trial_eligible: boolean
          updated_at: string | null
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          color_hex?: string | null
          created_at?: string | null
          curriculum_ids?: string[] | null
          day_of_week?: number | null
          days_of_week?: number[] | null
          description?: string | null
          discipline?: string | null
          discipline_ids?: string[] | null
          end_date?: string | null
          end_time?: string | null
          enrolled_count?: number
          fee_cents?: number | null
          gender?: string | null
          id?: string
          is_active?: boolean | null
          is_hidden?: boolean | null
          is_new?: boolean | null
          is_performance?: boolean | null
          is_rehearsal?: boolean | null
          levels?: string[] | null
          location_id?: string | null
          long_description?: string | null
          max_enrollment?: number | null
          max_students?: number | null
          medium_description?: string | null
          name: string
          new_expires_at?: string | null
          notes?: string | null
          online_registration?: boolean | null
          point_cost?: number
          room?: string | null
          room_id?: string | null
          season?: string | null
          season_id?: string | null
          short_description?: string | null
          show_capacity_public?: boolean | null
          start_date?: string | null
          start_time?: string | null
          status?: string
          style: string
          teacher_id?: string | null
          trial_eligible?: boolean
          updated_at?: string | null
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          color_hex?: string | null
          created_at?: string | null
          curriculum_ids?: string[] | null
          day_of_week?: number | null
          days_of_week?: number[] | null
          description?: string | null
          discipline?: string | null
          discipline_ids?: string[] | null
          end_date?: string | null
          end_time?: string | null
          enrolled_count?: number
          fee_cents?: number | null
          gender?: string | null
          id?: string
          is_active?: boolean | null
          is_hidden?: boolean | null
          is_new?: boolean | null
          is_performance?: boolean | null
          is_rehearsal?: boolean | null
          levels?: string[] | null
          location_id?: string | null
          long_description?: string | null
          max_enrollment?: number | null
          max_students?: number | null
          medium_description?: string | null
          name?: string
          new_expires_at?: string | null
          notes?: string | null
          online_registration?: boolean | null
          point_cost?: number
          room?: string | null
          room_id?: string | null
          season?: string | null
          season_id?: string | null
          short_description?: string | null
          show_capacity_public?: boolean | null
          start_date?: string | null
          start_time?: string | null
          status?: string
          style?: string
          teacher_id?: string | null
          trial_eligible?: boolean
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "studio_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_attachments: {
        Row: {
          content_type: string | null
          created_at: string
          filename: string
          id: string
          message_id: string
          size_bytes: number | null
          storage_path: string
          tenant_id: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          filename: string
          id?: string
          message_id: string
          size_bytes?: number | null
          storage_path: string
          tenant_id: string
        }
        Update: {
          content_type?: string | null
          created_at?: string
          filename?: string
          id?: string
          message_id?: string
          size_bytes?: number | null
          storage_path?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "communication_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_attachments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_messages: {
        Row: {
          body_html: string | null
          body_text: string | null
          created_at: string
          direction: string
          id: string
          in_reply_to: string | null
          matched: boolean
          message_id_header: string | null
          sender_email: string | null
          sender_id: string | null
          sender_name: string | null
          subject: string | null
          template_slug: string | null
          tenant_id: string
          thread_id: string
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          direction: string
          id?: string
          in_reply_to?: string | null
          matched?: boolean
          message_id_header?: string | null
          sender_email?: string | null
          sender_id?: string | null
          sender_name?: string | null
          subject?: string | null
          template_slug?: string | null
          tenant_id: string
          thread_id: string
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          direction?: string
          id?: string
          in_reply_to?: string | null
          matched?: boolean
          message_id_header?: string | null
          sender_email?: string | null
          sender_id?: string | null
          sender_name?: string | null
          subject?: string | null
          template_slug?: string | null
          tenant_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "communication_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_thread_reads: {
        Row: {
          id: string
          last_read_at: string
          thread_id: string
          user_id: string
        }
        Insert: {
          id?: string
          last_read_at?: string
          thread_id: string
          user_id: string
        }
        Update: {
          id?: string
          last_read_at?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_thread_reads_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "communication_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_thread_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_thread_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_threads: {
        Row: {
          assigned_to: string | null
          channel: string
          contact_email: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          family_id: string | null
          id: string
          last_message_at: string
          lead_id: string | null
          message_count: number
          priority: string
          staff_user_id: string | null
          state: string
          subject: string | null
          tenant_id: string
          thread_token: string
          thread_type: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          channel?: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          family_id?: string | null
          id?: string
          last_message_at?: string
          lead_id?: string | null
          message_count?: number
          priority?: string
          staff_user_id?: string | null
          state?: string
          subject?: string | null
          tenant_id: string
          thread_token: string
          thread_type?: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          channel?: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          family_id?: string | null
          id?: string
          last_message_at?: string
          lead_id?: string | null
          message_count?: number
          priority?: string
          staff_user_id?: string | null
          state?: string
          subject?: string | null
          tenant_id?: string
          thread_token?: string
          thread_type?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_threads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_threads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_threads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_threads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_threads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_studios: {
        Row: {
          address: string | null
          city: string | null
          created_at: string | null
          estimated_students: number | null
          google_rating: number | null
          google_review_count: number | null
          id: string
          last_researched_at: string | null
          name: string
          notes: string | null
          phone: string | null
          price_range: string | null
          programs: string[] | null
          segment: string | null
          state: string | null
          strengths: string[] | null
          threat_level: string | null
          updated_at: string | null
          weaknesses: string[] | null
          website: string | null
          yelp_rating: number | null
          yelp_review_count: number | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          estimated_students?: number | null
          google_rating?: number | null
          google_review_count?: number | null
          id?: string
          last_researched_at?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          price_range?: string | null
          programs?: string[] | null
          segment?: string | null
          state?: string | null
          strengths?: string[] | null
          threat_level?: string | null
          updated_at?: string | null
          weaknesses?: string[] | null
          website?: string | null
          yelp_rating?: number | null
          yelp_review_count?: number | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          estimated_students?: number | null
          google_rating?: number | null
          google_review_count?: number | null
          id?: string
          last_researched_at?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          price_range?: string | null
          programs?: string[] | null
          segment?: string | null
          state?: string | null
          strengths?: string[] | null
          threat_level?: string | null
          updated_at?: string | null
          weaknesses?: string[] | null
          website?: string | null
          yelp_rating?: number | null
          yelp_review_count?: number | null
        }
        Relationships: []
      }
      credit_accounts: {
        Row: {
          balance: number
          created_at: string
          family_id: string | null
          id: string
          lifetime_earned: number
          lifetime_spent: number
          student_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          family_id?: string | null
          id?: string
          lifetime_earned?: number
          lifetime_spent?: number
          student_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          family_id?: string | null
          id?: string
          lifetime_earned?: number
          lifetime_spent?: number
          student_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          account_id: string
          amount: number
          balance_after: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          reference_id: string | null
          tenant_id: string
          type: string
        }
        Insert: {
          account_id: string
          amount: number
          balance_after: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          tenant_id: string
          type: string
        }
        Update: {
          account_id?: string
          amount?: number
          balance_after?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      dance_curriculum: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          tenant_id?: string
        }
        Relationships: []
      }
      dances: {
        Row: {
          choreographer_id: string | null
          created_at: string
          discipline: string
          duration_seconds: number | null
          id: string
          level: string | null
          notes: string | null
          title: string
          updated_at: string
        }
        Insert: {
          choreographer_id?: string | null
          created_at?: string
          discipline: string
          duration_seconds?: number | null
          id?: string
          level?: string | null
          notes?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          choreographer_id?: string | null
          created_at?: string
          discipline?: string
          duration_seconds?: number | null
          id?: string
          level?: string | null
          notes?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dances_choreographer_id_fkey"
            columns: ["choreographer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dances_choreographer_id_fkey"
            columns: ["choreographer_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          created_at: string | null
          id: string
          last_seen_at: string | null
          platform: string
          profile_id: string
          tenant_id: string
          token: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_seen_at?: string | null
          platform: string
          profile_id: string
          tenant_id: string
          token: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_seen_at?: string | null
          platform?: string
          profile_id?: string
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_tokens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_tokens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      disciplines: {
        Row: {
          color_hex: string | null
          created_at: string | null
          description: string | null
          icon_id: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          tenant_id: string
        }
        Insert: {
          color_hex?: string | null
          created_at?: string | null
          description?: string | null
          icon_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          tenant_id: string
        }
        Update: {
          color_hex?: string | null
          created_at?: string | null
          description?: string | null
          icon_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disciplines_icon_id_fkey"
            columns: ["icon_id"]
            isOneToOne: false
            referencedRelation: "icon_library"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string
          button_text: string | null
          button_url: string | null
          description: string | null
          footer_text: string | null
          from_email: string
          from_name: string
          header_text: string | null
          id: string
          is_active: boolean | null
          name: string
          reply_to: string | null
          slug: string
          subject: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          body_html: string
          button_text?: string | null
          button_url?: string | null
          description?: string | null
          footer_text?: string | null
          from_email?: string
          from_name?: string
          header_text?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          reply_to?: string | null
          slug: string
          subject: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          body_html?: string
          button_text?: string | null
          button_url?: string | null
          description?: string | null
          footer_text?: string | null
          from_email?: string
          from_name?: string
          header_text?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          reply_to?: string | null
          slug?: string
          subject?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_cart_items: {
        Row: {
          cart_id: string
          class_id: string
          created_at: string
          id: string
          price_cents: number
          student_id: string | null
          student_name: string | null
          tenant_id: string
        }
        Insert: {
          cart_id: string
          class_id: string
          created_at?: string
          id?: string
          price_cents: number
          student_id?: string | null
          student_name?: string | null
          tenant_id: string
        }
        Update: {
          cart_id?: string
          class_id?: string
          created_at?: string
          id?: string
          price_cents?: number
          student_id?: string | null
          student_name?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "enrollment_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_cart_items_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_cart_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_carts: {
        Row: {
          created_at: string
          expires_at: string
          family_id: string | null
          id: string
          session_token: string
          status: string
          stripe_session_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          family_id?: string | null
          id?: string
          session_token: string
          status?: string
          stripe_session_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          family_id?: string | null
          id?: string
          session_token?: string
          status?: string
          stripe_session_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_carts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_recommendations: {
        Row: {
          bundle_config_id: string | null
          class_id: string | null
          created_at: string | null
          id: string
          recommendation_type: string
          responded_at: string | null
          responded_by: string | null
          snoozed_until: string | null
          status: string
          student_id: string
          tenant_id: string
        }
        Insert: {
          bundle_config_id?: string | null
          class_id?: string | null
          created_at?: string | null
          id?: string
          recommendation_type: string
          responded_at?: string | null
          responded_by?: string | null
          snoozed_until?: string | null
          status?: string
          student_id: string
          tenant_id: string
        }
        Update: {
          bundle_config_id?: string | null
          class_id?: string | null
          created_at?: string | null
          id?: string
          recommendation_type?: string
          responded_at?: string | null
          responded_by?: string | null
          snoozed_until?: string | null
          status?: string
          student_id?: string
          tenant_id?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          amount_paid_cents: number | null
          billing_plan_type: string | null
          cancelled_at: string | null
          class_id: string
          created_at: string | null
          dropped_at: string | null
          enrolled_at: string | null
          enrolled_by: string | null
          enrollment_type: string
          family_id: string | null
          id: string
          status: string
          stripe_payment_intent_id: string | null
          student_id: string
          suppress_onboarding: boolean
          tenant_id: string | null
          trial_class_date: string | null
          updated_at: string | null
        }
        Insert: {
          amount_paid_cents?: number | null
          billing_plan_type?: string | null
          cancelled_at?: string | null
          class_id: string
          created_at?: string | null
          dropped_at?: string | null
          enrolled_at?: string | null
          enrolled_by?: string | null
          enrollment_type?: string
          family_id?: string | null
          id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          student_id: string
          suppress_onboarding?: boolean
          tenant_id?: string | null
          trial_class_date?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_paid_cents?: number | null
          billing_plan_type?: string | null
          cancelled_at?: string | null
          class_id?: string
          created_at?: string | null
          dropped_at?: string | null
          enrolled_at?: string | null
          enrolled_by?: string | null
          enrollment_type?: string
          family_id?: string | null
          id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          student_id?: string
          suppress_onboarding?: boolean
          tenant_id?: string | null
          trial_class_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_question_bank: {
        Row: {
          created_at: string
          default_section: string | null
          hint_text: string | null
          id: string
          is_active: boolean
          is_global: boolean
          label: string
          question_type: string
          recommended_levels: string[] | null
          slug: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          default_section?: string | null
          hint_text?: string | null
          id?: string
          is_active?: boolean
          is_global?: boolean
          label: string
          question_type?: string
          recommended_levels?: string[] | null
          slug: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          default_section?: string | null
          hint_text?: string | null
          id?: string
          is_active?: boolean
          is_global?: boolean
          label?: string
          question_type?: string
          recommended_levels?: string[] | null
          slug?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_question_bank_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_requests: {
        Row: {
          assigned_teacher_id: string | null
          completed_at: string | null
          created_at: string | null
          experience_description: string | null
          id: string
          lead_id: string | null
          placement_notes: string | null
          recommended_level: string | null
          request_type: string
          requested_by: string | null
          scheduled_at: string | null
          status: string
          student_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          assigned_teacher_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          experience_description?: string | null
          id?: string
          lead_id?: string | null
          placement_notes?: string | null
          recommended_level?: string | null
          request_type?: string
          requested_by?: string | null
          scheduled_at?: string | null
          status?: string
          student_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          assigned_teacher_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          experience_description?: string | null
          id?: string
          lead_id?: string | null
          placement_notes?: string | null
          recommended_level?: string | null
          request_type?: string
          requested_by?: string | null
          scheduled_at?: string | null
          status?: string
          student_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      evaluation_template_questions: {
        Row: {
          hint_text: string | null
          id: string
          is_required: boolean
          label: string
          question_type: string
          section_id: string
          slug: string
          sort_order: number
          template_id: string
          tenant_id: string
        }
        Insert: {
          hint_text?: string | null
          id?: string
          is_required?: boolean
          label: string
          question_type?: string
          section_id: string
          slug: string
          sort_order?: number
          template_id: string
          tenant_id: string
        }
        Update: {
          hint_text?: string | null
          id?: string
          is_required?: boolean
          label?: string
          question_type?: string
          section_id?: string
          slug?: string
          sort_order?: number
          template_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_template_questions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "evaluation_template_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_template_questions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "evaluation_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_template_questions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_template_sections: {
        Row: {
          display_mode: string
          id: string
          slug: string
          sort_order: number
          template_id: string
          tenant_id: string
          title: string
        }
        Insert: {
          display_mode?: string
          id?: string
          slug: string
          sort_order?: number
          template_id: string
          tenant_id: string
          title: string
        }
        Update: {
          display_mode?: string
          id?: string
          slug?: string
          sort_order?: number
          template_id?: string
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_template_sections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "evaluation_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_template_sections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_templates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          level_tag: string | null
          name: string
          program_tag: string | null
          slug: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          level_tag?: string | null
          name: string
          program_tag?: string | null
          slug: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          level_tag?: string | null
          name?: string
          program_tag?: string | null
          slug?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expansion_markets: {
        Row: {
          city: string
          commercial_rent_per_sqft: number | null
          competitor_count: number | null
          cons: string[] | null
          created_at: string | null
          drive_time_minutes: number | null
          families_with_children_pct: number | null
          id: string
          median_household_income: number | null
          notes: string | null
          population: number | null
          pros: string[] | null
          readiness_score: number | null
          region: string | null
          state: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          city: string
          commercial_rent_per_sqft?: number | null
          competitor_count?: number | null
          cons?: string[] | null
          created_at?: string | null
          drive_time_minutes?: number | null
          families_with_children_pct?: number | null
          id?: string
          median_household_income?: number | null
          notes?: string | null
          population?: number | null
          pros?: string[] | null
          readiness_score?: number | null
          region?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          city?: string
          commercial_rent_per_sqft?: number | null
          competitor_count?: number | null
          cons?: string[] | null
          created_at?: string | null
          drive_time_minutes?: number | null
          families_with_children_pct?: number | null
          id?: string
          median_household_income?: number | null
          notes?: string | null
          population?: number | null
          pros?: string[] | null
          readiness_score?: number | null
          region?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      extended_contact_students: {
        Row: {
          extended_contact_id: string
          id: string
          student_id: string
        }
        Insert: {
          extended_contact_id: string
          id?: string
          student_id: string
        }
        Update: {
          extended_contact_id?: string
          id?: string
          student_id?: string
        }
        Relationships: []
      }
      extended_contacts: {
        Row: {
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          notes: string | null
          notify_live_stream: boolean
          notify_photos: boolean
          notify_recordings: boolean
          phone: string | null
          relationship: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          notes?: string | null
          notify_live_stream?: boolean
          notify_photos?: boolean
          notify_recordings?: boolean
          phone?: string | null
          relationship?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          notes?: string | null
          notify_live_stream?: boolean
          notify_photos?: boolean
          notify_recordings?: boolean
          phone?: string | null
          relationship?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      families: {
        Row: {
          account_credit: number
          billing_email: string | null
          billing_phone: string | null
          created_at: string
          family_name: string
          id: string
          notes: string | null
          primary_contact_id: string | null
          stripe_customer_id: string | null
          tenant_id: string
        }
        Insert: {
          account_credit?: number
          billing_email?: string | null
          billing_phone?: string | null
          created_at?: string
          family_name: string
          id?: string
          notes?: string | null
          primary_contact_id?: string | null
          stripe_customer_id?: string | null
          tenant_id: string
        }
        Update: {
          account_credit?: number
          billing_email?: string | null
          billing_phone?: string | null
          created_at?: string
          family_name?: string
          id?: string
          notes?: string | null
          primary_contact_id?: string | null
          stripe_customer_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "families_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "families_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "families_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      family_documents: {
        Row: {
          admin_notes: string | null
          contract_template_id: string | null
          created_at: string | null
          description: string | null
          document_type: string
          enrollment_id: string | null
          expires_at: string | null
          expiry_reminder_sent_at: string | null
          external_url: string | null
          family_id: string | null
          file_size_bytes: number | null
          file_url: string | null
          id: string
          requires_signature: boolean | null
          season_id: string | null
          signature_data: string | null
          signed_at: string | null
          signed_by: string | null
          status: string
          student_id: string | null
          tenant_id: string
          title: string
          updated_at: string | null
          uploaded_by: string | null
          uploaded_on_behalf: boolean | null
          visible_to_parent: boolean
          visible_to_student: boolean
        }
        Insert: {
          admin_notes?: string | null
          contract_template_id?: string | null
          created_at?: string | null
          description?: string | null
          document_type: string
          enrollment_id?: string | null
          expires_at?: string | null
          expiry_reminder_sent_at?: string | null
          external_url?: string | null
          family_id?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          requires_signature?: boolean | null
          season_id?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: string
          student_id?: string | null
          tenant_id: string
          title: string
          updated_at?: string | null
          uploaded_by?: string | null
          uploaded_on_behalf?: boolean | null
          visible_to_parent?: boolean
          visible_to_student?: boolean
        }
        Update: {
          admin_notes?: string | null
          contract_template_id?: string | null
          created_at?: string | null
          description?: string | null
          document_type?: string
          enrollment_id?: string | null
          expires_at?: string | null
          expiry_reminder_sent_at?: string | null
          external_url?: string | null
          family_id?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          requires_signature?: boolean | null
          season_id?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: string
          student_id?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string | null
          uploaded_by?: string | null
          uploaded_on_behalf?: boolean | null
          visible_to_parent?: boolean
          visible_to_student?: boolean
        }
        Relationships: []
      }
      icon_library: {
        Row: {
          category: string
          created_at: string
          icon_url: string | null
          id: string
          is_active: boolean
          is_global: boolean
          name: string
          slug: string
          sort_order: number
          tenant_id: string | null
          website_url: string | null
        }
        Insert: {
          category: string
          created_at?: string
          icon_url?: string | null
          id?: string
          is_active?: boolean
          is_global?: boolean
          name: string
          slug: string
          sort_order?: number
          tenant_id?: string | null
          website_url?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          icon_url?: string | null
          id?: string
          is_active?: boolean
          is_global?: boolean
          name?: string
          slug?: string
          sort_order?: number
          tenant_id?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "icon_library_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_teacher_id: string | null
          communication_thread_id: string | null
          created_at: string
          email: string | null
          evaluation_completed_at: string | null
          evaluation_scheduled_at: string | null
          family_id: string | null
          first_name: string
          id: string
          intake_form_data: Json | null
          last_name: string | null
          notes: string | null
          phone: string | null
          pipeline_stage: string
          placement_notes: string | null
          recommended_class_ids: string[] | null
          returning_student_id: string | null
          source: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_teacher_id?: string | null
          communication_thread_id?: string | null
          created_at?: string
          email?: string | null
          evaluation_completed_at?: string | null
          evaluation_scheduled_at?: string | null
          family_id?: string | null
          first_name: string
          id?: string
          intake_form_data?: Json | null
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          pipeline_stage?: string
          placement_notes?: string | null
          recommended_class_ids?: string[] | null
          returning_student_id?: string | null
          source?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_teacher_id?: string | null
          communication_thread_id?: string | null
          created_at?: string
          email?: string | null
          evaluation_completed_at?: string | null
          evaluation_scheduled_at?: string | null
          family_id?: string | null
          first_name?: string
          id?: string
          intake_form_data?: Json | null
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          pipeline_stage?: string
          placement_notes?: string | null
          recommended_class_ids?: string[] | null
          returning_student_id?: string | null
          source?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      level_up_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          current_class_id: string | null
          id: string
          requested_by: string
          requested_class_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          student_id: string
          teacher_note: string | null
          tenant_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          current_class_id?: string | null
          id?: string
          requested_by: string
          requested_class_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id: string
          teacher_note?: string | null
          tenant_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          current_class_id?: string | null
          id?: string
          requested_by?: string
          requested_class_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id?: string
          teacher_note?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "level_up_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      live_sessions: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          class_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_paid: boolean | null
          max_viewers: number | null
          playback_url: string | null
          recording_url: string | null
          scheduled_start: string
          session_type: string
          status: string
          stream_key: string | null
          teacher_id: string | null
          ticket_price_cents: number | null
          title: string
          updated_at: string | null
          viewer_count: number | null
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          class_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_paid?: boolean | null
          max_viewers?: number | null
          playback_url?: string | null
          recording_url?: string | null
          scheduled_start: string
          session_type: string
          status?: string
          stream_key?: string | null
          teacher_id?: string | null
          ticket_price_cents?: number | null
          title: string
          updated_at?: string | null
          viewer_count?: number | null
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          class_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_paid?: boolean | null
          max_viewers?: number | null
          playback_url?: string | null
          recording_url?: string | null
          scheduled_start?: string
          session_type?: string
          status?: string
          stream_key?: string | null
          teacher_id?: string | null
          ticket_price_cents?: number | null
          title?: string
          updated_at?: string | null
          viewer_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_content: {
        Row: {
          content_type: string
          created_at: string | null
          description: string | null
          duration_seconds: number | null
          id: string
          is_published: boolean | null
          like_count: number | null
          sort_order: number | null
          tags: string[] | null
          target_age_max: number | null
          target_age_min: number | null
          target_level: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          uploaded_by: string | null
          video_url: string | null
          view_count: number | null
        }
        Insert: {
          content_type: string
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_published?: boolean | null
          like_count?: number | null
          sort_order?: number | null
          tags?: string[] | null
          target_age_max?: number | null
          target_age_min?: number | null
          target_level?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          uploaded_by?: string | null
          video_url?: string | null
          view_count?: number | null
        }
        Update: {
          content_type?: string
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_published?: boolean | null
          like_count?: number | null
          sort_order?: number | null
          tags?: string[] | null
          target_age_max?: number | null
          target_age_min?: number | null
          target_level?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          uploaded_by?: string | null
          video_url?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lms_content_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_content_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      location_hours: {
        Row: {
          close_time: string | null
          created_at: string | null
          day_of_week: number
          id: string
          is_open: boolean
          location_id: string
          notes: string | null
          open_time: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          close_time?: string | null
          created_at?: string | null
          day_of_week: number
          id?: string
          is_open?: boolean
          location_id: string
          notes?: string | null
          open_time?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          close_time?: string | null
          created_at?: string | null
          day_of_week?: number
          id?: string
          is_open?: boolean
          location_id?: string
          notes?: string | null
          open_time?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_hours_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "studio_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_hours_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mandated_reporter_incidents: {
        Row: {
          action_taken: string | null
          admin_acknowledged_at: string | null
          admin_acknowledged_by: string | null
          authority_name: string | null
          concern_type: string
          created_at: string | null
          description: string
          id: string
          observed_at: string
          report_number: string | null
          reported_to_authorities: boolean | null
          reported_to_authorities_at: string | null
          reporter_id: string
          status: string
          student_id: string | null
        }
        Insert: {
          action_taken?: string | null
          admin_acknowledged_at?: string | null
          admin_acknowledged_by?: string | null
          authority_name?: string | null
          concern_type: string
          created_at?: string | null
          description: string
          id?: string
          observed_at: string
          report_number?: string | null
          reported_to_authorities?: boolean | null
          reported_to_authorities_at?: string | null
          reporter_id: string
          status?: string
          student_id?: string | null
        }
        Update: {
          action_taken?: string | null
          admin_acknowledged_at?: string | null
          admin_acknowledged_by?: string | null
          authority_name?: string | null
          concern_type?: string
          created_at?: string | null
          description?: string
          id?: string
          observed_at?: string
          report_number?: string | null
          reported_to_authorities?: boolean | null
          reported_to_authorities_at?: string | null
          reporter_id?: string
          status?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mandated_reporter_incidents_admin_acknowledged_by_fkey"
            columns: ["admin_acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandated_reporter_incidents_admin_acknowledged_by_fkey"
            columns: ["admin_acknowledged_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandated_reporter_incidents_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandated_reporter_incidents_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandated_reporter_incidents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      module_permissions: {
        Row: {
          can_approve: boolean
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_export: boolean
          can_override: boolean
          can_view: boolean
          id: string
          module: string
          role: Database["public"]["Enums"]["user_role_type"]
        }
        Insert: {
          can_approve?: boolean
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_override?: boolean
          can_view?: boolean
          id?: string
          module: string
          role: Database["public"]["Enums"]["user_role_type"]
        }
        Update: {
          can_approve?: boolean
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_override?: boolean
          can_view?: boolean
          id?: string
          module?: string
          role?: Database["public"]["Enums"]["user_role_type"]
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          announcements: boolean | null
          attendance_summary: boolean | null
          billing: boolean | null
          check_in: boolean | null
          class_reminder: boolean | null
          email_enabled: boolean | null
          late_pickup: boolean | null
          profile_id: string
          push_enabled: boolean | null
          rehearsal_schedule: boolean | null
          tenant_id: string
          timesheet_reminder: boolean | null
          updated_at: string | null
        }
        Insert: {
          announcements?: boolean | null
          attendance_summary?: boolean | null
          billing?: boolean | null
          check_in?: boolean | null
          class_reminder?: boolean | null
          email_enabled?: boolean | null
          late_pickup?: boolean | null
          profile_id: string
          push_enabled?: boolean | null
          rehearsal_schedule?: boolean | null
          tenant_id: string
          timesheet_reminder?: boolean | null
          updated_at?: string | null
        }
        Update: {
          announcements?: boolean | null
          attendance_summary?: boolean | null
          billing?: boolean | null
          check_in?: boolean | null
          class_reminder?: boolean | null
          email_enabled?: boolean | null
          late_pickup?: boolean | null
          profile_id?: string
          push_enabled?: boolean | null
          rehearsal_schedule?: boolean | null
          tenant_id?: string
          timesheet_reminder?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          metadata: Json | null
          notification_type: string
          read_at: string | null
          recipient_id: string
          tenant_id: string | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          notification_type: string
          read_at?: string | null
          recipient_id: string
          tenant_id?: string | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          notification_type?: string
          read_at?: string | null
          recipient_id?: string
          tenant_id?: string | null
          title?: string
        }
        Relationships: []
      }
      pay_periods: {
        Row: {
          created_at: string
          id: string
          pay_cadence: string
          period_month: number
          period_year: number
          status: string
          submission_deadline: string
          teacher_edit_cutoff: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pay_cadence?: string
          period_month: number
          period_year: number
          status?: string
          submission_deadline: string
          teacher_edit_cutoff?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pay_cadence?: string
          period_month?: number
          period_year?: number
          status?: string
          submission_deadline?: string
          teacher_edit_cutoff?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pay_periods_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_change_log: {
        Row: {
          change_type: string
          changed_by: string | null
          created_at: string
          field_changed: string | null
          id: string
          new_value: string | null
          note: string | null
          old_value: string | null
          source: string | null
          tenant_id: string
          timesheet_entry_id: string
        }
        Insert: {
          change_type: string
          changed_by?: string | null
          created_at?: string
          field_changed?: string | null
          id?: string
          new_value?: string | null
          note?: string | null
          old_value?: string | null
          source?: string | null
          tenant_id: string
          timesheet_entry_id: string
        }
        Update: {
          change_type?: string
          changed_by?: string | null
          created_at?: string
          field_changed?: string | null
          id?: string
          new_value?: string | null
          note?: string | null
          old_value?: string | null
          source?: string | null
          tenant_id?: string
          timesheet_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_change_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_change_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_change_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_change_log_timesheet_entry_id_fkey"
            columns: ["timesheet_entry_id"]
            isOneToOne: false
            referencedRelation: "timesheet_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          key: string
          label: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          key: string
          label: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          label?: string
        }
        Relationships: []
      }
      platform_modules: {
        Row: {
          created_at: string
          description: string | null
          href: string | null
          icon: string
          id: string
          key: string
          label: string
          nav_group: string
          nav_visible: boolean
          platform_enabled: boolean
          requires_role: string | null
          sort_order: number
          tenant_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          href?: string | null
          icon?: string
          id?: string
          key: string
          label: string
          nav_group: string
          nav_visible?: boolean
          platform_enabled?: boolean
          requires_role?: string | null
          sort_order?: number
          tenant_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          href?: string | null
          icon?: string
          id?: string
          key?: string
          label?: string
          nav_group?: string
          nav_visible?: boolean
          platform_enabled?: boolean
          requires_role?: string | null
          sort_order?: number
          tenant_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      private_billing_records: {
        Row: {
          admin_confirmed: boolean | null
          admin_entered_calendar: boolean
          billing_split_confirmed: boolean
          created_at: string
          id: string
          teacher_confirmed: boolean
          tenant_id: string
          timesheet_entry_id: string
          updated_at: string
        }
        Insert: {
          admin_confirmed?: boolean | null
          admin_entered_calendar?: boolean
          billing_split_confirmed?: boolean
          created_at?: string
          id?: string
          teacher_confirmed?: boolean
          tenant_id: string
          timesheet_entry_id: string
          updated_at?: string
        }
        Update: {
          admin_confirmed?: boolean | null
          admin_entered_calendar?: boolean
          billing_split_confirmed?: boolean
          created_at?: string
          id?: string
          teacher_confirmed?: boolean
          tenant_id?: string
          timesheet_entry_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_billing_records_timesheet_entry_id_fkey"
            columns: ["timesheet_entry_id"]
            isOneToOne: true
            referencedRelation: "timesheet_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      private_billing_splits: {
        Row: {
          billing_account_id: string | null
          billing_account_override: boolean
          billing_account_suggested: string | null
          billing_status: Database["public"]["Enums"]["billing_status"]
          charge_reference: string | null
          created_at: string
          date_card_charged: string | null
          dispute_notes: string | null
          id: string
          private_billing_record_id: string
          split_amount: number
          student_id: string
          tenant_id: string
          updated_at: string
          waiver_reason: string | null
        }
        Insert: {
          billing_account_id?: string | null
          billing_account_override?: boolean
          billing_account_suggested?: string | null
          billing_status?: Database["public"]["Enums"]["billing_status"]
          charge_reference?: string | null
          created_at?: string
          date_card_charged?: string | null
          dispute_notes?: string | null
          id?: string
          private_billing_record_id: string
          split_amount: number
          student_id: string
          tenant_id: string
          updated_at?: string
          waiver_reason?: string | null
        }
        Update: {
          billing_account_id?: string | null
          billing_account_override?: boolean
          billing_account_suggested?: string | null
          billing_status?: Database["public"]["Enums"]["billing_status"]
          charge_reference?: string | null
          created_at?: string
          date_card_charged?: string | null
          dispute_notes?: string | null
          id?: string
          private_billing_record_id?: string
          split_amount?: number
          student_id?: string
          tenant_id?: string
          updated_at?: string
          waiver_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "private_billing_splits_private_billing_record_id_fkey"
            columns: ["private_billing_record_id"]
            isOneToOne: false
            referencedRelation: "private_billing_records"
            referencedColumns: ["id"]
          },
        ]
      }
      private_session_billing: {
        Row: {
          amount_owed: number | null
          billing_status: string
          created_at: string
          credit_transaction_id: string | null
          family_id: string
          id: string
          market_value: number | null
          paid_at: string | null
          payment_method: string | null
          points_owed: number | null
          session_id: string
          split_percentage: number | null
          student_id: string
          studio_contribution: number | null
          teacher_contribution: number | null
          teacher_contribution_note: string | null
          tenant_id: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount_owed?: number | null
          billing_status?: string
          created_at?: string
          credit_transaction_id?: string | null
          family_id: string
          id?: string
          market_value?: number | null
          paid_at?: string | null
          payment_method?: string | null
          points_owed?: number | null
          session_id: string
          split_percentage?: number | null
          student_id: string
          studio_contribution?: number | null
          teacher_contribution?: number | null
          teacher_contribution_note?: string | null
          tenant_id: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_owed?: number | null
          billing_status?: string
          created_at?: string
          credit_transaction_id?: string | null
          family_id?: string
          id?: string
          market_value?: number | null
          paid_at?: string | null
          payment_method?: string | null
          points_owed?: number | null
          session_id?: string
          split_percentage?: number | null
          student_id?: string
          studio_contribution?: number | null
          teacher_contribution?: number | null
          teacher_contribution_note?: string | null
          tenant_id?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_session_billing_credit_transaction_id_fkey"
            columns: ["credit_transaction_id"]
            isOneToOne: false
            referencedRelation: "credit_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_session_billing_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_session_billing_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "private_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_session_billing_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_session_billing_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      private_sessions: {
        Row: {
          availability_slot_id: string | null
          billing_model: string
          billing_status: string
          booking_source: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          co_teacher_ids: string[] | null
          contribution_note: string | null
          created_at: string
          created_by: string | null
          duration_minutes: number | null
          end_time: string
          google_event_id: string | null
          ical_uid: string | null
          id: string
          is_recurring: boolean
          location_notes: string | null
          market_rate: number | null
          parent_visible_notes: string | null
          primary_teacher_id: string
          recurrence_parent_id: string | null
          recurrence_rule: string | null
          session_date: string
          session_notes: string | null
          session_rate: number | null
          session_type: string
          start_time: string
          status: string
          student_can_see_notes: boolean | null
          student_ids: string[]
          studio: string | null
          studio_contribution: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          availability_slot_id?: string | null
          billing_model?: string
          billing_status?: string
          booking_source?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          co_teacher_ids?: string[] | null
          contribution_note?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          end_time: string
          google_event_id?: string | null
          ical_uid?: string | null
          id?: string
          is_recurring?: boolean
          location_notes?: string | null
          market_rate?: number | null
          parent_visible_notes?: string | null
          primary_teacher_id: string
          recurrence_parent_id?: string | null
          recurrence_rule?: string | null
          session_date: string
          session_notes?: string | null
          session_rate?: number | null
          session_type: string
          start_time: string
          status?: string
          student_can_see_notes?: boolean | null
          student_ids: string[]
          studio?: string | null
          studio_contribution?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          availability_slot_id?: string | null
          billing_model?: string
          billing_status?: string
          booking_source?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          co_teacher_ids?: string[] | null
          contribution_note?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          end_time?: string
          google_event_id?: string | null
          ical_uid?: string | null
          id?: string
          is_recurring?: boolean
          location_notes?: string | null
          market_rate?: number | null
          parent_visible_notes?: string | null
          primary_teacher_id?: string
          recurrence_parent_id?: string | null
          recurrence_rule?: string | null
          session_date?: string
          session_notes?: string | null
          session_rate?: number | null
          session_type?: string
          start_time?: string
          status?: string
          student_can_see_notes?: boolean | null
          student_ids?: string[]
          studio?: string | null
          studio_contribution?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_sessions_availability_slot_id_fkey"
            columns: ["availability_slot_id"]
            isOneToOne: false
            referencedRelation: "teacher_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_sessions_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_sessions_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_sessions_primary_teacher_id_fkey"
            columns: ["primary_teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_sessions_primary_teacher_id_fkey"
            columns: ["primary_teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_sessions_recurrence_parent_id_fkey"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "private_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      production_dances: {
        Row: {
          costume_description: string | null
          costume_due_date: string | null
          costume_notes: string | null
          created_at: string
          dance_id: string
          id: string
          music_artist: string | null
          music_duration_seconds: number | null
          music_file_url: string | null
          music_title: string | null
          notes: string | null
          performance_order: number
          performance_type: string
          production_id: string
          stage_notes: string | null
          updated_at: string
        }
        Insert: {
          costume_description?: string | null
          costume_due_date?: string | null
          costume_notes?: string | null
          created_at?: string
          dance_id: string
          id?: string
          music_artist?: string | null
          music_duration_seconds?: number | null
          music_file_url?: string | null
          music_title?: string | null
          notes?: string | null
          performance_order?: number
          performance_type?: string
          production_id: string
          stage_notes?: string | null
          updated_at?: string
        }
        Update: {
          costume_description?: string | null
          costume_due_date?: string | null
          costume_notes?: string | null
          created_at?: string
          dance_id?: string
          id?: string
          music_artist?: string | null
          music_duration_seconds?: number | null
          music_file_url?: string | null
          music_title?: string | null
          notes?: string | null
          performance_order?: number
          performance_type?: string
          production_id?: string
          stage_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_dances_dance_id_fkey"
            columns: ["dance_id"]
            isOneToOne: false
            referencedRelation: "dances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_dances_production_id_fkey"
            columns: ["production_id"]
            isOneToOne: false
            referencedRelation: "productions"
            referencedColumns: ["id"]
          },
        ]
      }
      productions: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          call_time: string | null
          competition_division: string | null
          competition_org: string | null
          created_at: string
          end_time: string | null
          id: string
          is_published: boolean
          name: string
          notes: string | null
          performance_date: string | null
          production_type: string
          season: string | null
          start_time: string | null
          updated_at: string
          venue_address: string | null
          venue_directions: string | null
          venue_name: string | null
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          call_time?: string | null
          competition_division?: string | null
          competition_org?: string | null
          created_at?: string
          end_time?: string | null
          id?: string
          is_published?: boolean
          name: string
          notes?: string | null
          performance_date?: string | null
          production_type?: string
          season?: string | null
          start_time?: string | null
          updated_at?: string
          venue_address?: string | null
          venue_directions?: string | null
          venue_name?: string | null
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          call_time?: string | null
          competition_division?: string | null
          competition_org?: string | null
          created_at?: string
          end_time?: string | null
          id?: string
          is_published?: boolean
          name?: string
          notes?: string | null
          performance_date?: string | null
          production_type?: string
          season?: string | null
          start_time?: string | null
          updated_at?: string
          venue_address?: string | null
          venue_directions?: string | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "productions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          colors: string[] | null
          compare_at_price_cents: number | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          images: string[] | null
          inventory: number | null
          is_active: boolean | null
          name: string
          price_cents: number
          shop_config_id: string
          sizes: string[] | null
          slug: string
          sort_order: number | null
          stripe_price_id: string | null
          track_inventory: boolean | null
          updated_at: string | null
        }
        Insert: {
          category: string
          colors?: string[] | null
          compare_at_price_cents?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          inventory?: number | null
          is_active?: boolean | null
          name: string
          price_cents: number
          shop_config_id: string
          sizes?: string[] | null
          slug: string
          sort_order?: number | null
          stripe_price_id?: string | null
          track_inventory?: boolean | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          colors?: string[] | null
          compare_at_price_cents?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          inventory?: number | null
          is_active?: boolean | null
          name?: string
          price_cents?: number
          shop_config_id?: string
          sizes?: string[] | null
          slug?: string
          sort_order?: number | null
          stripe_price_id?: string | null
          track_inventory?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_shop_config_id_fkey"
            columns: ["shop_config_id"]
            isOneToOne: false
            referencedRelation: "shop_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          created_at: string
          id: string
          is_active: boolean
          is_primary: boolean
          role: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          role: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          role?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          avatar_url: string | null
          bio_full: string | null
          bio_short: string | null
          city: string | null
          country: string | null
          created_at: string | null
          education: string | null
          email: string | null
          email_opt_in: boolean
          first_name: string | null
          id: string
          is_teacher: boolean | null
          last_name: string | null
          latitude: number | null
          longitude: number | null
          onboarding_complete: boolean | null
          phone: string | null
          preferred_name: string | null
          role: Database["public"]["Enums"]["user_role"]
          sms_opt_in: boolean
          social_instagram: string | null
          social_linkedin: string | null
          sort_order: number | null
          state: string | null
          stripe_customer_id: string | null
          title: string | null
          updated_at: string | null
          years_experience: number | null
          zip_code: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          avatar_url?: string | null
          bio_full?: string | null
          bio_short?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          education?: string | null
          email?: string | null
          email_opt_in?: boolean
          first_name?: string | null
          id: string
          is_teacher?: boolean | null
          last_name?: string | null
          latitude?: number | null
          longitude?: number | null
          onboarding_complete?: boolean | null
          phone?: string | null
          preferred_name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          sms_opt_in?: boolean
          social_instagram?: string | null
          social_linkedin?: string | null
          sort_order?: number | null
          state?: string | null
          stripe_customer_id?: string | null
          title?: string | null
          updated_at?: string | null
          years_experience?: number | null
          zip_code?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          avatar_url?: string | null
          bio_full?: string | null
          bio_short?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          education?: string | null
          email?: string | null
          email_opt_in?: boolean
          first_name?: string | null
          id?: string
          is_teacher?: boolean | null
          last_name?: string | null
          latitude?: number | null
          longitude?: number | null
          onboarding_complete?: boolean | null
          phone?: string | null
          preferred_name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          sms_opt_in?: boolean
          social_instagram?: string | null
          social_linkedin?: string | null
          sort_order?: number | null
          state?: string | null
          stripe_customer_id?: string | null
          title?: string | null
          updated_at?: string | null
          years_experience?: number | null
          zip_code?: string | null
        }
        Relationships: []
      }
      rehearsal_attendance: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          rehearsal_id: string
          status: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          rehearsal_id: string
          status?: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          rehearsal_id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rehearsal_attendance_rehearsal_id_fkey"
            columns: ["rehearsal_id"]
            isOneToOne: false
            referencedRelation: "rehearsals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rehearsal_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      rehearsals: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          end_time: string
          id: string
          is_mandatory: boolean
          location: string | null
          location_address: string | null
          location_directions: string | null
          notes: string | null
          production_dance_id: string
          rehearsal_date: string
          rehearsal_type: string
          start_time: string
          updated_at: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          end_time: string
          id?: string
          is_mandatory?: boolean
          location?: string | null
          location_address?: string | null
          location_directions?: string | null
          notes?: string | null
          production_dance_id: string
          rehearsal_date: string
          rehearsal_type?: string
          start_time: string
          updated_at?: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          end_time?: string
          id?: string
          is_mandatory?: boolean
          location?: string | null
          location_address?: string | null
          location_directions?: string | null
          notes?: string | null
          production_dance_id?: string
          rehearsal_date?: string
          rehearsal_type?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rehearsals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rehearsals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rehearsals_production_dance_id_fkey"
            columns: ["production_dance_id"]
            isOneToOne: false
            referencedRelation: "production_dances"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_system: boolean
          name: string
          tenant_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          tenant_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          tenant_id?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          capacity: number | null
          color_hex: string | null
          created_at: string
          description: string | null
          hourly_rate_private: number | null
          icon_id: string | null
          id: string
          is_active: boolean
          is_bookable: boolean | null
          location_id: string | null
          name: string
          notes: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          color_hex?: string | null
          created_at?: string
          description?: string | null
          hourly_rate_private?: number | null
          icon_id?: string | null
          id?: string
          is_active?: boolean
          is_bookable?: boolean | null
          location_id?: string | null
          name: string
          notes?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          color_hex?: string | null
          created_at?: string
          description?: string | null
          hourly_rate_private?: number | null
          icon_id?: string | null
          id?: string
          is_active?: boolean
          is_bookable?: boolean | null
          location_id?: string | null
          name?: string
          notes?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_icon_id_fkey"
            columns: ["icon_id"]
            isOneToOne: false
            referencedRelation: "icon_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "studio_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_approvers: {
        Row: {
          created_at: string
          id: string
          production_id: string | null
          scope: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          production_id?: string | null
          scope?: string
          staff_id: string
        }
        Update: {
          created_at?: string
          id?: string
          production_id?: string | null
          scope?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_approvers_production_id_fkey"
            columns: ["production_id"]
            isOneToOne: false
            referencedRelation: "productions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_approvers_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_approvers_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_change_requests: {
        Row: {
          approval_status: string | null
          change_type: string
          created_at: string
          id: string
          instance_id: string
          notifications_sent: boolean | null
          previous_state: Json
          proposed_state: Json
          rejection_reason: string | null
          requested_at: string | null
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          approval_status?: string | null
          change_type: string
          created_at?: string
          id?: string
          instance_id: string
          notifications_sent?: boolean | null
          previous_state: Json
          proposed_state: Json
          rejection_reason?: string | null
          requested_at?: string | null
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          approval_status?: string | null
          change_type?: string
          created_at?: string
          id?: string
          instance_id?: string
          notifications_sent?: boolean | null
          previous_state?: Json
          proposed_state?: Json
          rejection_reason?: string | null
          requested_at?: string | null
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_change_requests_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "schedule_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_change_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_change_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_change_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_change_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_change_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_embeds: {
        Row: {
          allow_filter_age: boolean | null
          allow_filter_class_type: boolean | null
          allow_filter_day: boolean | null
          allow_filter_level: boolean | null
          allow_filter_rehearsal: boolean | null
          allow_filter_season: boolean | null
          allow_filter_teacher: boolean | null
          allow_filter_trial: boolean | null
          created_at: string
          created_by: string | null
          default_age_max: number | null
          default_age_min: number | null
          default_class_types: string[] | null
          default_days: number[] | null
          default_levels: string[] | null
          default_season_id: string | null
          default_teacher_id: string | null
          display_mode: string | null
          embed_token: string
          id: string
          name: string
          show_capacity: boolean | null
          show_rehearsals: boolean | null
          show_room: boolean | null
          show_teacher: boolean | null
          show_trials_only: boolean | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          allow_filter_age?: boolean | null
          allow_filter_class_type?: boolean | null
          allow_filter_day?: boolean | null
          allow_filter_level?: boolean | null
          allow_filter_rehearsal?: boolean | null
          allow_filter_season?: boolean | null
          allow_filter_teacher?: boolean | null
          allow_filter_trial?: boolean | null
          created_at?: string
          created_by?: string | null
          default_age_max?: number | null
          default_age_min?: number | null
          default_class_types?: string[] | null
          default_days?: number[] | null
          default_levels?: string[] | null
          default_season_id?: string | null
          default_teacher_id?: string | null
          display_mode?: string | null
          embed_token: string
          id?: string
          name: string
          show_capacity?: boolean | null
          show_rehearsals?: boolean | null
          show_room?: boolean | null
          show_teacher?: boolean | null
          show_trials_only?: boolean | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          allow_filter_age?: boolean | null
          allow_filter_class_type?: boolean | null
          allow_filter_day?: boolean | null
          allow_filter_level?: boolean | null
          allow_filter_rehearsal?: boolean | null
          allow_filter_season?: boolean | null
          allow_filter_teacher?: boolean | null
          allow_filter_trial?: boolean | null
          created_at?: string
          created_by?: string | null
          default_age_max?: number | null
          default_age_min?: number | null
          default_class_types?: string[] | null
          default_days?: number[] | null
          default_levels?: string[] | null
          default_season_id?: string | null
          default_teacher_id?: string | null
          display_mode?: string | null
          embed_token?: string
          id?: string
          name?: string
          show_capacity?: boolean | null
          show_rehearsals?: boolean | null
          show_room?: boolean | null
          show_teacher?: boolean | null
          show_trials_only?: boolean | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_embeds_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_embeds_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_embeds_default_season_id_fkey"
            columns: ["default_season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_embeds_default_teacher_id_fkey"
            columns: ["default_teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_embeds_default_teacher_id_fkey"
            columns: ["default_teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_embeds_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_instances: {
        Row: {
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          cancellation_reason: string | null
          class_id: string | null
          created_at: string
          created_by: string | null
          end_time: string
          event_date: string
          event_type: string
          ical_uid: string | null
          id: string
          is_trial_eligible: boolean | null
          notes: string | null
          notification_sent_at: string | null
          production_id: string | null
          room_id: string | null
          start_time: string
          status: string
          substitute_teacher_id: string | null
          teacher_id: string | null
          template_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          cancellation_reason?: string | null
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          end_time: string
          event_date: string
          event_type?: string
          ical_uid?: string | null
          id?: string
          is_trial_eligible?: boolean | null
          notes?: string | null
          notification_sent_at?: string | null
          production_id?: string | null
          room_id?: string | null
          start_time: string
          status?: string
          substitute_teacher_id?: string | null
          teacher_id?: string | null
          template_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          cancellation_reason?: string | null
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          end_time?: string
          event_date?: string
          event_type?: string
          ical_uid?: string | null
          id?: string
          is_trial_eligible?: boolean | null
          notes?: string | null
          notification_sent_at?: string | null
          production_id?: string | null
          room_id?: string | null
          start_time?: string
          status?: string
          substitute_teacher_id?: string | null
          teacher_id?: string | null
          template_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_instances_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_instances_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_instances_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_instances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_instances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_instances_production_id_fkey"
            columns: ["production_id"]
            isOneToOne: false
            referencedRelation: "productions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_instances_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_instances_substitute_teacher_id_fkey"
            columns: ["substitute_teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_instances_substitute_teacher_id_fkey"
            columns: ["substitute_teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_instances_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_instances_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "schedule_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_instances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_templates: {
        Row: {
          class_id: string
          created_at: string
          day_of_week: number
          end_time: string
          event_type: string | null
          id: string
          is_active: boolean | null
          is_trial_eligible: boolean | null
          max_capacity: number | null
          room_id: string | null
          season_id: string
          start_time: string
          teacher_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          event_type?: string | null
          id?: string
          is_active?: boolean | null
          is_trial_eligible?: boolean | null
          max_capacity?: number | null
          room_id?: string | null
          season_id: string
          start_time: string
          teacher_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          event_type?: string | null
          id?: string
          is_active?: boolean | null
          is_trial_eligible?: boolean | null
          max_capacity?: number | null
          room_id?: string | null
          season_id?: string
          start_time?: string
          teacher_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_templates_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_templates_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_templates_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_templates_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_templates_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      season_placement_releases: {
        Row: {
          created_at: string | null
          executed_at: string | null
          families_notified: number | null
          id: string
          released_by: string | null
          scheduled_for: string | null
          season_id: string
          students_placed: number | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          executed_at?: string | null
          families_notified?: number | null
          id?: string
          released_by?: string | null
          scheduled_for?: string | null
          season_id: string
          students_placed?: number | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          executed_at?: string | null
          families_notified?: number | null
          id?: string
          released_by?: string | null
          scheduled_for?: string | null
          season_id?: string
          students_placed?: number | null
          tenant_id?: string
        }
        Relationships: []
      }
      season_placements: {
        Row: {
          class_id: string
          created_at: string | null
          id: string
          placed_by: string | null
          placement_notes: string | null
          placement_type: string
          released_at: string | null
          responded_at: string | null
          response_notes: string | null
          season_id: string
          status: string
          student_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          class_id: string
          created_at?: string | null
          id?: string
          placed_by?: string | null
          placement_notes?: string | null
          placement_type?: string
          released_at?: string | null
          responded_at?: string | null
          response_notes?: string | null
          season_id: string
          status?: string
          student_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string | null
          id?: string
          placed_by?: string | null
          placement_notes?: string | null
          placement_type?: string
          released_at?: string | null
          responded_at?: string | null
          response_notes?: string | null
          season_id?: string
          status?: string
          student_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      seasons: {
        Row: {
          created_at: string
          display_priority: number
          end_date: string
          id: string
          is_active: boolean | null
          is_ongoing: boolean
          is_public: boolean | null
          name: string
          period: string | null
          program: string | null
          registration_open: boolean | null
          start_date: string
          tenant_id: string
          updated_at: string
          year: number | null
        }
        Insert: {
          created_at?: string
          display_priority?: number
          end_date: string
          id?: string
          is_active?: boolean | null
          is_ongoing?: boolean
          is_public?: boolean | null
          name: string
          period?: string | null
          program?: string | null
          registration_open?: boolean | null
          start_date: string
          tenant_id: string
          updated_at?: string
          year?: number | null
        }
        Update: {
          created_at?: string
          display_priority?: number
          end_date?: string
          id?: string
          is_active?: boolean | null
          is_ongoing?: boolean
          is_public?: boolean | null
          name?: string
          period?: string | null
          program?: string | null
          registration_open?: boolean | null
          start_date?: string
          tenant_id?: string
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "seasons_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_configs: {
        Row: {
          activated_at: string | null
          banner_url: string | null
          closes_at: string | null
          created_at: string | null
          deactivated_at: string | null
          event_name: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          opens_at: string | null
          primary_color: string | null
          secondary_color: string | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          activated_at?: string | null
          banner_url?: string | null
          closes_at?: string | null
          created_at?: string | null
          deactivated_at?: string | null
          event_name?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          opens_at?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          activated_at?: string | null
          banner_url?: string | null
          closes_at?: string | null
          created_at?: string | null
          deactivated_at?: string | null
          event_name?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          opens_at?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      shop_orders: {
        Row: {
          created_at: string | null
          customer_email: string
          customer_id: string | null
          customer_name: string
          discount_cents: number
          discount_code: string | null
          fulfilled_at: string | null
          fulfillment_status: string | null
          id: string
          items: Json
          notes: string | null
          order_number: string
          paid_at: string | null
          payment_method: string | null
          payment_status: string
          shop_config_id: string
          stripe_payment_intent_id: string | null
          subtotal_cents: number
          tax_cents: number
          total_cents: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_email: string
          customer_id?: string | null
          customer_name: string
          discount_cents?: number
          discount_code?: string | null
          fulfilled_at?: string | null
          fulfillment_status?: string | null
          id?: string
          items?: Json
          notes?: string | null
          order_number: string
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          shop_config_id: string
          stripe_payment_intent_id?: string | null
          subtotal_cents: number
          tax_cents?: number
          total_cents: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_email?: string
          customer_id?: string | null
          customer_name?: string
          discount_cents?: number
          discount_code?: string | null
          fulfilled_at?: string | null
          fulfillment_status?: string | null
          id?: string
          items?: Json
          notes?: string | null
          order_number?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          shop_config_id?: string
          stripe_payment_intent_id?: string | null
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_orders_shop_config_id_fkey"
            columns: ["shop_config_id"]
            isOneToOne: false
            referencedRelation: "shop_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_assessments: {
        Row: {
          assessed_at: string | null
          class_id: string | null
          created_at: string | null
          id: string
          notes: string | null
          score: number
          skill_area: string
          student_id: string
          teacher_id: string
          visible_to_parent: boolean | null
        }
        Insert: {
          assessed_at?: string | null
          class_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          score: number
          skill_area: string
          student_id: string
          teacher_id: string
          visible_to_parent?: boolean | null
        }
        Update: {
          assessed_at?: string | null
          class_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          score?: number
          skill_area?: string
          student_id?: string
          teacher_id?: string
          visible_to_parent?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "skill_assessments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_assessments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_assessments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_assessments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_messages: {
        Row: {
          body: string
          created_at: string
          direction: string
          id: string
          quo_message_id: string | null
          sent_by: string | null
          status: string
          tenant_id: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          direction: string
          id?: string
          quo_message_id?: string | null
          sent_by?: string | null
          status?: string
          tenant_id: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          direction?: string
          id?: string
          quo_message_id?: string | null
          sent_by?: string | null
          status?: string
          tenant_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "sms_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_threads: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          phone_number: string
          profile_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          phone_number: string
          profile_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          phone_number?: string
          profile_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_threads_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_threads_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_threads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string
          file_size: number | null
          file_url: string
          group_name: string | null
          id: string
          is_active: boolean
          notes: string | null
          profile_id: string
          tenant_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_type: string
          file_name: string
          file_size?: number | null
          file_url: string
          group_name?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          profile_id: string
          tenant_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          group_name?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          profile_id?: string
          tenant_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_access: {
        Row: {
          access_type: string
          amount_paid_cents: number | null
          created_at: string | null
          id: string
          purchased_at: string | null
          session_id: string
          stripe_payment_intent_id: string | null
          user_id: string
        }
        Insert: {
          access_type: string
          amount_paid_cents?: number | null
          created_at?: string | null
          id?: string
          purchased_at?: string | null
          session_id: string
          stripe_payment_intent_id?: string | null
          user_id: string
        }
        Update: {
          access_type?: string
          amount_paid_cents?: number | null
          created_at?: string | null
          id?: string
          purchased_at?: string | null
          session_id?: string
          stripe_payment_intent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_access_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stream_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stream_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_badges: {
        Row: {
          awarded_at: string | null
          awarded_by: string | null
          badge_id: string
          id: string
          notes: string | null
          patch_distributed_at: string | null
          patch_ordered_at: string | null
          patch_status: string | null
          student_id: string
          tenant_id: string | null
        }
        Insert: {
          awarded_at?: string | null
          awarded_by?: string | null
          badge_id: string
          id?: string
          notes?: string | null
          patch_distributed_at?: string | null
          patch_ordered_at?: string | null
          patch_status?: string | null
          student_id: string
          tenant_id?: string | null
        }
        Update: {
          awarded_at?: string | null
          awarded_by?: string | null
          badge_id?: string
          id?: string
          notes?: string | null
          patch_distributed_at?: string | null
          patch_ordered_at?: string | null
          patch_status?: string | null
          student_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_badges_awarded_by_fkey"
            columns: ["awarded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_badges_awarded_by_fkey"
            columns: ["awarded_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_badges_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_badges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_content_progress: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          content_id: string
          created_at: string | null
          id: string
          liked: boolean | null
          student_id: string
          updated_at: string | null
          watched_seconds: number | null
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          content_id: string
          created_at?: string | null
          id?: string
          liked?: boolean | null
          student_id: string
          updated_at?: string | null
          watched_seconds?: number | null
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          content_id?: string
          created_at?: string | null
          id?: string
          liked?: boolean | null
          student_id?: string
          updated_at?: string | null
          watched_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "student_content_progress_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "lms_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_content_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_evaluation_history: {
        Row: {
          changed_by: string | null
          created_at: string
          evaluation_id: string
          id: string
          new_state: Json | null
          note: string | null
          previous_state: Json | null
          tenant_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          evaluation_id: string
          id?: string
          new_state?: Json | null
          note?: string | null
          previous_state?: Json | null
          tenant_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          evaluation_id?: string
          id?: string
          new_state?: Json | null
          note?: string | null
          previous_state?: Json | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_evaluation_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_evaluation_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_evaluation_history_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "student_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_evaluation_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_evaluation_responses: {
        Row: {
          created_at: string
          evaluation_id: string
          id: string
          question_id: string
          rating: string | null
          tenant_id: string
          text_value: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          evaluation_id: string
          id?: string
          question_id: string
          rating?: string | null
          tenant_id: string
          text_value?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          evaluation_id?: string
          id?: string
          question_id?: string
          rating?: string | null
          tenant_id?: string
          text_value?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_evaluation_responses_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "student_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_evaluation_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "evaluation_template_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_evaluation_responses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_evaluations: {
        Row: {
          admin_note: string | null
          approved_at: string | null
          approved_by: string | null
          attributed_to_name: string | null
          body: string | null
          class_id: string | null
          created_at: string
          evaluation_type: string
          evaluator_id: string | null
          id: string
          is_private: boolean
          published_at: string | null
          season_id: string | null
          skill_ratings: Json | null
          status: string
          student_id: string
          submitted_at: string | null
          template_id: string | null
          tenant_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attributed_to_name?: string | null
          body?: string | null
          class_id?: string | null
          created_at?: string
          evaluation_type: string
          evaluator_id?: string | null
          id?: string
          is_private?: boolean
          published_at?: string | null
          season_id?: string | null
          skill_ratings?: Json | null
          status?: string
          student_id: string
          submitted_at?: string | null
          template_id?: string | null
          tenant_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attributed_to_name?: string | null
          body?: string | null
          class_id?: string | null
          created_at?: string
          evaluation_type?: string
          evaluator_id?: string | null
          id?: string
          is_private?: boolean
          published_at?: string | null
          season_id?: string | null
          skill_ratings?: Json | null
          status?: string
          student_id?: string
          submitted_at?: string | null
          template_id?: string | null
          tenant_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_evaluations_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_evaluations_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_evaluations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "evaluation_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_evaluations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_families: {
        Row: {
          created_at: string
          family_id: string
          id: string
          is_primary: boolean
          relationship: string | null
          student_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          is_primary?: boolean
          relationship?: string | null
          student_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          is_primary?: boolean
          relationship?: string | null
          student_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_families_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_families_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_families_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_google_photo_albums: {
        Row: {
          album_url: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          sort_order: number
          student_id: string
          tenant_id: string
        }
        Insert: {
          album_url: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          student_id: string
          tenant_id: string
        }
        Update: {
          album_url?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          student_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_google_photo_albums_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_guardians: {
        Row: {
          created_at: string
          id: string
          is_billing: boolean
          is_emergency: boolean
          is_primary: boolean
          portal_access: boolean
          profile_id: string
          relationship: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_billing?: boolean
          is_emergency?: boolean
          is_primary?: boolean
          portal_access?: boolean
          profile_id: string
          relationship: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_billing?: boolean
          is_emergency?: boolean
          is_primary?: boolean
          portal_access?: boolean
          profile_id?: string
          relationship?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_guardians_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_guardians_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_guardians_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_profile_relatives: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          relationship: string
          share_token: string
          student_id: string
          tenant_id: string
          vanity_slug: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          relationship: string
          share_token?: string
          student_id: string
          tenant_id: string
          vanity_slug?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          relationship?: string
          share_token?: string
          student_id?: string
          tenant_id?: string
          vanity_slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_profile_relatives_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_profile_share_permissions: {
        Row: {
          id: string
          is_visible: boolean
          relative_id: string
          section_key: string
          tenant_id: string
        }
        Insert: {
          id?: string
          is_visible?: boolean
          relative_id: string
          section_key: string
          tenant_id: string
        }
        Update: {
          id?: string
          is_visible?: boolean
          relative_id?: string
          section_key?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_profile_share_permissions_relative_id_fkey"
            columns: ["relative_id"]
            isOneToOne: false
            referencedRelation: "student_profile_relatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_profile_share_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          active: boolean | null
          address_line_1: string | null
          address_line_2: string | null
          age_group: string | null
          allergy_notes: string | null
          avatar_url: string | null
          city: string | null
          country: string | null
          created_at: string | null
          current_level: string | null
          date_of_birth: string
          emergency_contact: Json | null
          family_id: string | null
          first_name: string
          gender: string | null
          id: string
          is_adult: boolean | null
          is_self_account: boolean
          last_name: string
          latitude: number | null
          longitude: number | null
          media_consent: boolean
          media_consent_date: string | null
          medical_notes: string | null
          parent_id: string
          photo_consent: boolean | null
          preferred_name: string | null
          state: string | null
          student_type: string
          tenant_id: string | null
          trial_used: boolean | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          active?: boolean | null
          address_line_1?: string | null
          address_line_2?: string | null
          age_group?: string | null
          allergy_notes?: string | null
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          current_level?: string | null
          date_of_birth: string
          emergency_contact?: Json | null
          family_id?: string | null
          first_name: string
          gender?: string | null
          id?: string
          is_adult?: boolean | null
          is_self_account?: boolean
          last_name: string
          latitude?: number | null
          longitude?: number | null
          media_consent?: boolean
          media_consent_date?: string | null
          medical_notes?: string | null
          parent_id: string
          photo_consent?: boolean | null
          preferred_name?: string | null
          state?: string | null
          student_type?: string
          tenant_id?: string | null
          trial_used?: boolean | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          active?: boolean | null
          address_line_1?: string | null
          address_line_2?: string | null
          age_group?: string | null
          allergy_notes?: string | null
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          current_level?: string | null
          date_of_birth?: string
          emergency_contact?: Json | null
          family_id?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          is_adult?: boolean | null
          is_self_account?: boolean
          last_name?: string
          latitude?: number | null
          longitude?: number | null
          media_consent?: boolean
          media_consent_date?: string | null
          medical_notes?: string | null
          parent_id?: string
          photo_consent?: boolean | null
          preferred_name?: string | null
          state?: string | null
          student_type?: string
          tenant_id?: string | null
          trial_used?: boolean | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_announcements: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          scheduled_for: string | null
          send_email: boolean
          send_in_app: boolean
          send_sms: boolean
          sent_at: string | null
          status: string
          target_class_id: string | null
          target_profile_ids: string[] | null
          target_type: string
          tenant_id: string
          title: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          scheduled_for?: string | null
          send_email?: boolean
          send_in_app?: boolean
          send_sms?: boolean
          sent_at?: string | null
          status?: string
          target_class_id?: string | null
          target_profile_ids?: string[] | null
          target_type?: string
          tenant_id: string
          title: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          scheduled_for?: string | null
          send_email?: boolean
          send_in_app?: boolean
          send_sms?: boolean
          sent_at?: string | null
          status?: string
          target_class_id?: string | null
          target_profile_ids?: string[] | null
          target_type?: string
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_announcements_target_class_id_fkey"
            columns: ["target_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_announcements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_closures: {
        Row: {
          closed_date: string
          created_at: string | null
          id: string
          reason: string | null
          tenant_id: string
        }
        Insert: {
          closed_date: string
          created_at?: string | null
          id?: string
          reason?: string | null
          tenant_id: string
        }
        Update: {
          closed_date?: string
          created_at?: string | null
          id?: string
          reason?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      studio_locations: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          id: string
          is_active: boolean
          is_primary: boolean
          name: string
          sort_order: number
          state: string | null
          tenant_id: string
          updated_at: string
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          name: string
          sort_order?: number
          state?: string | null
          tenant_id: string
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          name?: string
          sort_order?: number
          state?: string | null
          tenant_id?: string
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "studio_locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_resource_assignments: {
        Row: {
          class_id: string
          created_at: string
          id: string
          resource_id: string
          tenant_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          resource_id: string
          tenant_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          resource_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_resource_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_resource_assignments_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "studio_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_resources: {
        Row: {
          capacity: number | null
          color: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_portable: boolean
          location_id: string | null
          name: string
          sort_order: number
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_portable?: boolean
          location_id?: string | null
          name: string
          sort_order?: number
          tenant_id: string
          type: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_portable?: boolean
          location_id?: string | null
          name?: string
          sort_order?: number
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_resources_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "studio_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_settings: {
        Row: {
          app_icon_url: string | null
          body_font: string
          custom_colors: Json | null
          favicon_url: string | null
          heading_font: string
          id: string
          logo_dark_url: string | null
          logo_light_url: string | null
          logo_url: string | null
          student_term_plural: string | null
          student_term_singular: string | null
          studio_name: string
          theme_preset: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          app_icon_url?: string | null
          body_font?: string
          custom_colors?: Json | null
          favicon_url?: string | null
          heading_font?: string
          id?: string
          logo_dark_url?: string | null
          logo_light_url?: string | null
          logo_url?: string | null
          student_term_plural?: string | null
          student_term_singular?: string | null
          studio_name?: string
          theme_preset?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          app_icon_url?: string | null
          body_font?: string
          custom_colors?: Json | null
          favicon_url?: string | null
          heading_font?: string
          id?: string
          logo_dark_url?: string | null
          logo_light_url?: string | null
          logo_url?: string | null
          student_term_plural?: string | null
          student_term_singular?: string | null
          studio_name?: string
          theme_preset?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      substitute_alerts: {
        Row: {
          alert_channel: string[] | null
          alert_sent_at: string | null
          created_at: string
          id: string
          request_id: string
          responded_at: string | null
          response: string | null
          teacher_id: string
          tenant_id: string
        }
        Insert: {
          alert_channel?: string[] | null
          alert_sent_at?: string | null
          created_at?: string
          id?: string
          request_id: string
          responded_at?: string | null
          response?: string | null
          teacher_id: string
          tenant_id: string
        }
        Update: {
          alert_channel?: string[] | null
          alert_sent_at?: string | null
          created_at?: string
          id?: string
          request_id?: string
          responded_at?: string | null
          response?: string | null
          teacher_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "substitute_alerts_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "substitute_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitute_alerts_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitute_alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      substitute_authorizations: {
        Row: {
          authorized_for_levels: string[] | null
          authorized_for_types: string[] | null
          created_at: string
          id: string
          is_active: boolean | null
          notes: string | null
          priority_order: number | null
          teacher_id: string
          tenant_id: string
        }
        Insert: {
          authorized_for_levels?: string[] | null
          authorized_for_types?: string[] | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          priority_order?: number | null
          teacher_id: string
          tenant_id: string
        }
        Update: {
          authorized_for_levels?: string[] | null
          authorized_for_types?: string[] | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          priority_order?: number | null
          teacher_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "substitute_authorizations_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitute_authorizations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      substitute_requests: {
        Row: {
          created_at: string
          filled_at: string | null
          filled_by: string | null
          id: string
          instance_id: string
          reason: string | null
          requesting_teacher_id: string
          status: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          filled_at?: string | null
          filled_by?: string | null
          id?: string
          instance_id: string
          reason?: string | null
          requesting_teacher_id: string
          status?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          filled_at?: string | null
          filled_by?: string | null
          id?: string
          instance_id?: string
          reason?: string | null
          requesting_teacher_id?: string
          status?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "substitute_requests_filled_by_fkey"
            columns: ["filled_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitute_requests_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "schedule_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitute_requests_requesting_teacher_id_fkey"
            columns: ["requesting_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitute_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_affiliations: {
        Row: {
          affiliation_type: string
          created_at: string
          description: string | null
          icon_id: string | null
          id: string
          location: string | null
          name: string
          role: string | null
          sort_order: number
          teacher_id: string
          tenant_id: string
          years: string | null
        }
        Insert: {
          affiliation_type: string
          created_at?: string
          description?: string | null
          icon_id?: string | null
          id?: string
          location?: string | null
          name: string
          role?: string | null
          sort_order?: number
          teacher_id: string
          tenant_id: string
          years?: string | null
        }
        Update: {
          affiliation_type?: string
          created_at?: string
          description?: string | null
          icon_id?: string | null
          id?: string
          location?: string | null
          name?: string
          role?: string | null
          sort_order?: number
          teacher_id?: string
          tenant_id?: string
          years?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_affiliations_icon_id_fkey"
            columns: ["icon_id"]
            isOneToOne: false
            referencedRelation: "icon_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_affiliations_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_affiliations_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_affiliations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_availability: {
        Row: {
          created_at: string
          day_of_week: number | null
          end_time: string
          id: string
          is_booked: boolean
          is_published: boolean
          is_recurring: boolean
          max_students: number
          slot_type: string
          specific_date: string | null
          start_time: string
          teacher_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          day_of_week?: number | null
          end_time: string
          id?: string
          is_booked?: boolean
          is_published?: boolean
          is_recurring?: boolean
          max_students?: number
          slot_type?: string
          specific_date?: string | null
          start_time: string
          teacher_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number | null
          end_time?: string
          id?: string
          is_booked?: boolean
          is_published?: boolean
          is_recurring?: boolean
          max_students?: number
          slot_type?: string
          specific_date?: string | null
          start_time?: string
          teacher_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_availability_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_availability_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_availability_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_booking_approvals: {
        Row: {
          approved_at: string
          approved_by: string | null
          family_id: string
          id: string
          is_active: boolean
          notes: string | null
          student_ids: string[] | null
          teacher_id: string
          tenant_id: string
        }
        Insert: {
          approved_at?: string
          approved_by?: string | null
          family_id: string
          id?: string
          is_active?: boolean
          notes?: string | null
          student_ids?: string[] | null
          teacher_id: string
          tenant_id: string
        }
        Update: {
          approved_at?: string
          approved_by?: string | null
          family_id?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          student_ids?: string[] | null
          teacher_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_booking_approvals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_booking_approvals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_booking_approvals_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_booking_approvals_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_booking_approvals_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_booking_approvals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_compliance: {
        Row: {
          background_check_date: string | null
          background_check_expiry: string | null
          background_check_status: string
          cpr_expiry: string | null
          cpr_status: string
          created_at: string
          id: string
          mandated_reporter_date: string | null
          mandated_reporter_expiry: string | null
          mandated_reporter_status: string
          notes: string | null
          teacher_id: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
          w9_received_date: string | null
          w9_status: string
        }
        Insert: {
          background_check_date?: string | null
          background_check_expiry?: string | null
          background_check_status?: string
          cpr_expiry?: string | null
          cpr_status?: string
          created_at?: string
          id?: string
          mandated_reporter_date?: string | null
          mandated_reporter_expiry?: string | null
          mandated_reporter_status?: string
          notes?: string | null
          teacher_id: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          w9_received_date?: string | null
          w9_status?: string
        }
        Update: {
          background_check_date?: string | null
          background_check_expiry?: string | null
          background_check_status?: string
          cpr_expiry?: string | null
          cpr_status?: string
          created_at?: string
          id?: string
          mandated_reporter_date?: string | null
          mandated_reporter_expiry?: string | null
          mandated_reporter_status?: string
          notes?: string | null
          teacher_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          w9_received_date?: string | null
          w9_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_compliance_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_compliance_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_compliance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_compliance_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_compliance_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_disciplines: {
        Row: {
          created_at: string
          icon_id: string | null
          id: string
          is_certified: boolean
          name: string
          sort_order: number
          teacher_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          icon_id?: string | null
          id?: string
          is_certified?: boolean
          name: string
          sort_order?: number
          teacher_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          icon_id?: string | null
          id?: string
          is_certified?: boolean
          name?: string
          sort_order?: number
          teacher_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_disciplines_icon_id_fkey"
            columns: ["icon_id"]
            isOneToOne: false
            referencedRelation: "icon_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_disciplines_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_disciplines_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_disciplines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_hours: {
        Row: {
          approved: boolean | null
          approved_at: string | null
          approved_by: string | null
          category: string
          class_id: string | null
          created_at: string | null
          date: string
          hours: number
          id: string
          notes: string | null
          teacher_id: string
          updated_at: string | null
        }
        Insert: {
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          category: string
          class_id?: string | null
          created_at?: string | null
          date: string
          hours: number
          id?: string
          notes?: string | null
          teacher_id: string
          updated_at?: string | null
        }
        Update: {
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          category?: string
          class_id?: string | null
          created_at?: string | null
          date?: string
          hours?: number
          id?: string
          notes?: string | null
          teacher_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_hours_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_hours_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_hours_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_hours_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_hours_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          is_active: boolean
          photo_url: string
          sort_order: number
          teacher_id: string
          tenant_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          photo_url: string
          sort_order?: number
          teacher_id: string
          tenant_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          photo_url?: string
          sort_order?: number
          teacher_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_photos_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_photos_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_photos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_rate_cards: {
        Row: {
          cancellation_notice_hours: number
          cancellation_policy_note: string | null
          created_at: string
          id: string
          is_active: boolean
          late_cancel_charge_pct: number
          market_rate_30: number | null
          market_rate_45: number | null
          market_rate_60: number | null
          no_show_charge_pct: number
          point_cost: number
          session_type: string
          standard_rate_30: number | null
          standard_rate_45: number | null
          standard_rate_60: number | null
          teacher_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cancellation_notice_hours?: number
          cancellation_policy_note?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          late_cancel_charge_pct?: number
          market_rate_30?: number | null
          market_rate_45?: number | null
          market_rate_60?: number | null
          no_show_charge_pct?: number
          point_cost?: number
          session_type: string
          standard_rate_30?: number | null
          standard_rate_45?: number | null
          standard_rate_60?: number | null
          teacher_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cancellation_notice_hours?: number
          cancellation_policy_note?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          late_cancel_charge_pct?: number
          market_rate_30?: number | null
          market_rate_45?: number | null
          market_rate_60?: number | null
          no_show_charge_pct?: number
          point_cost?: number
          session_type?: string
          standard_rate_30?: number | null
          standard_rate_45?: number | null
          standard_rate_60?: number | null
          teacher_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_rate_cards_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_rate_cards_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_rate_cards_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_specialties: {
        Row: {
          created_at: string
          id: string
          sort_order: number
          specialty: string
          teacher_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sort_order?: number
          specialty: string
          teacher_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sort_order?: number
          specialty?: string
          teacher_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_specialties_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_specialties_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_specialties_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_sub_eligibility: {
        Row: {
          created_at: string
          eligible_disciplines: string[] | null
          eligible_levels: string[] | null
          id: string
          is_sub_eligible: boolean
          notes: string | null
          teacher_id: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          eligible_disciplines?: string[] | null
          eligible_levels?: string[] | null
          id?: string
          is_sub_eligible?: boolean
          notes?: string | null
          teacher_id: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          eligible_disciplines?: string[] | null
          eligible_levels?: string[] | null
          id?: string
          is_sub_eligible?: boolean
          notes?: string | null
          teacher_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_sub_eligibility_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_sub_eligibility_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_sub_eligibility_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_sub_eligibility_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_sub_eligibility_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          admin_rate_cents: number | null
          background_check_complete: boolean | null
          background_check_expires_at: string | null
          bio: string | null
          can_be_scheduled: boolean | null
          certifications: string[] | null
          class_rate_cents: number | null
          created_at: string | null
          employment_type: string | null
          headshot_url: string | null
          hire_date: string | null
          id: string
          is_active: boolean | null
          is_mandated_reporter_certified: boolean | null
          is_sub_eligible: boolean | null
          mandated_reporter_cert_date: string | null
          mandated_reporter_cert_expires_at: string | null
          private_rate_cents: number | null
          rehearsal_rate_cents: number | null
          specialties: string[] | null
          substitute_session_count: number | null
          substitute_session_threshold: number | null
          updated_at: string | null
          w9_on_file: boolean | null
        }
        Insert: {
          admin_rate_cents?: number | null
          background_check_complete?: boolean | null
          background_check_expires_at?: string | null
          bio?: string | null
          can_be_scheduled?: boolean | null
          certifications?: string[] | null
          class_rate_cents?: number | null
          created_at?: string | null
          employment_type?: string | null
          headshot_url?: string | null
          hire_date?: string | null
          id: string
          is_active?: boolean | null
          is_mandated_reporter_certified?: boolean | null
          is_sub_eligible?: boolean | null
          mandated_reporter_cert_date?: string | null
          mandated_reporter_cert_expires_at?: string | null
          private_rate_cents?: number | null
          rehearsal_rate_cents?: number | null
          specialties?: string[] | null
          substitute_session_count?: number | null
          substitute_session_threshold?: number | null
          updated_at?: string | null
          w9_on_file?: boolean | null
        }
        Update: {
          admin_rate_cents?: number | null
          background_check_complete?: boolean | null
          background_check_expires_at?: string | null
          bio?: string | null
          can_be_scheduled?: boolean | null
          certifications?: string[] | null
          class_rate_cents?: number | null
          created_at?: string | null
          employment_type?: string | null
          headshot_url?: string | null
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          is_mandated_reporter_certified?: boolean | null
          is_sub_eligible?: boolean | null
          mandated_reporter_cert_date?: string | null
          mandated_reporter_cert_expires_at?: string | null
          private_rate_cents?: number | null
          rehearsal_rate_cents?: number | null
          specialties?: string[] | null
          substitute_session_count?: number | null
          substitute_session_threshold?: number | null
          updated_at?: string | null
          w9_on_file?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "teachers_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teachers_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_assistant_config: {
        Row: {
          assistant_avatar_url: string | null
          assistant_name: string
          created_at: string
          director_name: string
          enrollment_enabled: boolean
          greeting_message: string
          id: string
          primary_color: string
          tenant_id: string
          trial_enabled: boolean
          updated_at: string
        }
        Insert: {
          assistant_avatar_url?: string | null
          assistant_name?: string
          created_at?: string
          director_name?: string
          enrollment_enabled?: boolean
          greeting_message?: string
          id?: string
          primary_color?: string
          tenant_id: string
          trial_enabled?: boolean
          updated_at?: string
        }
        Update: {
          assistant_avatar_url?: string | null
          assistant_name?: string
          created_at?: string
          director_name?: string
          enrollment_enabled?: boolean
          greeting_message?: string
          id?: string
          primary_color?: string
          tenant_id?: string
          trial_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_assistant_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_program_types: {
        Row: {
          color: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          is_public: boolean
          name: string
          slug: string
          tenant_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          is_public?: boolean
          name: string
          slug: string
          tenant_id: string
        }
        Update: {
          color?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          is_public?: boolean
          name?: string
          slug?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_program_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          angelina_enabled: boolean
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          angelina_enabled?: boolean
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          angelina_enabled?: boolean
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      timesheet_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          is_resolved: boolean
          message: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          session_id: string | null
          severity: string
          tenant_id: string
          timesheet_entry_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          is_resolved?: boolean
          message: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string | null
          severity: string
          tenant_id: string
          timesheet_entry_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          is_resolved?: boolean
          message?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string | null
          severity?: string
          tenant_id?: string
          timesheet_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_alerts_timesheet_entry_id_fkey"
            columns: ["timesheet_entry_id"]
            isOneToOne: false
            referencedRelation: "timesheet_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_entries: {
        Row: {
          adjusted_by: string | null
          adjustment_note: string | null
          approved_at: string | null
          approved_by: string | null
          attendance_status: string | null
          class_id: string | null
          competition_id: string | null
          created_at: string
          date: string
          description: string | null
          end_time: string | null
          entry_type: string
          event_tag: string | null
          flag_question: string | null
          flag_responded_at: string | null
          flag_response: string | null
          flagged_at: string | null
          flagged_by: string | null
          id: string
          is_auto_populated: boolean
          is_substitute: boolean
          notes: string | null
          paid_at: string | null
          production_id: string | null
          production_name: string | null
          rate_amount: number | null
          rate_key: string | null
          rate_override: boolean
          rate_override_by: string | null
          schedule_instance_id: string | null
          session_id: string | null
          start_time: string | null
          status: string
          sub_for: string | null
          submitted_at: string | null
          substitute_for_teacher_id: string | null
          substitute_notes: string | null
          teacher_role: string
          tenant_id: string
          timesheet_id: string
          total_hours: number
          updated_at: string
        }
        Insert: {
          adjusted_by?: string | null
          adjustment_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attendance_status?: string | null
          class_id?: string | null
          competition_id?: string | null
          created_at?: string
          date: string
          description?: string | null
          end_time?: string | null
          entry_type: string
          event_tag?: string | null
          flag_question?: string | null
          flag_responded_at?: string | null
          flag_response?: string | null
          flagged_at?: string | null
          flagged_by?: string | null
          id?: string
          is_auto_populated?: boolean
          is_substitute?: boolean
          notes?: string | null
          paid_at?: string | null
          production_id?: string | null
          production_name?: string | null
          rate_amount?: number | null
          rate_key?: string | null
          rate_override?: boolean
          rate_override_by?: string | null
          schedule_instance_id?: string | null
          session_id?: string | null
          start_time?: string | null
          status?: string
          sub_for?: string | null
          submitted_at?: string | null
          substitute_for_teacher_id?: string | null
          substitute_notes?: string | null
          teacher_role?: string
          tenant_id: string
          timesheet_id: string
          total_hours?: number
          updated_at?: string
        }
        Update: {
          adjusted_by?: string | null
          adjustment_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attendance_status?: string | null
          class_id?: string | null
          competition_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          end_time?: string | null
          entry_type?: string
          event_tag?: string | null
          flag_question?: string | null
          flag_responded_at?: string | null
          flag_response?: string | null
          flagged_at?: string | null
          flagged_by?: string | null
          id?: string
          is_auto_populated?: boolean
          is_substitute?: boolean
          notes?: string | null
          paid_at?: string | null
          production_id?: string | null
          production_name?: string | null
          rate_amount?: number | null
          rate_key?: string | null
          rate_override?: boolean
          rate_override_by?: string | null
          schedule_instance_id?: string | null
          session_id?: string | null
          start_time?: string | null
          status?: string
          sub_for?: string | null
          submitted_at?: string | null
          substitute_for_teacher_id?: string | null
          substitute_notes?: string | null
          teacher_role?: string
          tenant_id?: string
          timesheet_id?: string
          total_hours?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_entries_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_entries_rate_override_by_fkey"
            columns: ["rate_override_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_entries_rate_override_by_fkey"
            columns: ["rate_override_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_entries_schedule_instance_id_fkey"
            columns: ["schedule_instance_id"]
            isOneToOne: false
            referencedRelation: "schedule_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "schedule_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_entries_substitute_for_teacher_id_fkey"
            columns: ["substitute_for_teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_entries_substitute_for_teacher_id_fkey"
            columns: ["substitute_for_teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_entries_timesheet_id_fkey"
            columns: ["timesheet_id"]
            isOneToOne: false
            referencedRelation: "timesheets"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_entry_changes: {
        Row: {
          change_type: string
          changed_by: string
          changed_by_name: string | null
          created_at: string
          entry_id: string
          field_changed: string | null
          id: string
          new_value: string | null
          note: string | null
          old_value: string | null
          tenant_id: string
        }
        Insert: {
          change_type: string
          changed_by: string
          changed_by_name?: string | null
          created_at?: string
          entry_id: string
          field_changed?: string | null
          id?: string
          new_value?: string | null
          note?: string | null
          old_value?: string | null
          tenant_id: string
        }
        Update: {
          change_type?: string
          changed_by?: string
          changed_by_name?: string | null
          created_at?: string
          entry_id?: string
          field_changed?: string | null
          id?: string
          new_value?: string | null
          note?: string | null
          old_value?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      timesheets: {
        Row: {
          created_at: string
          id: string
          pay_period_id: string
          rejection_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          teacher_id: string
          tenant_id: string
          total_hours: number | null
          total_pay: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          pay_period_id: string
          rejection_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          teacher_id: string
          tenant_id: string
          total_hours?: number | null
          total_pay?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          pay_period_id?: string
          rejection_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          teacher_id?: string
          tenant_id?: string
          total_hours?: number | null
          total_pay?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_pay_period_id_fkey"
            columns: ["pay_period_id"]
            isOneToOne: false
            referencedRelation: "pay_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_history: {
        Row: {
          class_id: string
          created_at: string
          enrollment_id: string | null
          id: string
          lead_id: string | null
          outcome: string
          student_id: string
          tenant_id: string
          trial_date: string | null
        }
        Insert: {
          class_id: string
          created_at?: string
          enrollment_id?: string | null
          id?: string
          lead_id?: string | null
          outcome?: string
          student_id: string
          tenant_id: string
          trial_date?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          enrollment_id?: string | null
          id?: string
          lead_id?: string | null
          outcome?: string
          student_id?: string
          tenant_id?: string
          trial_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trial_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      teacher_profiles: {
        Row: {
          avatar_url: string | null
          email: string | null
          employment_type: string | null
          first_name: string | null
          hire_date: string | null
          id: string | null
          is_active: boolean | null
          last_name: string | null
          phone: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_or_create_dm_channel: {
        Args: { p_profile_a: string; p_profile_b: string; p_tenant_id: string }
        Returns: string
      }
      get_user_role: { Args: never; Returns: string }
      has_permission: { Args: { perm_key: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_channel_member: {
        Args: { p_channel_id: string; p_profile_id: string }
        Returns: boolean
      }
      is_front_desk: { Args: never; Returns: boolean }
      is_schedule_approver: { Args: never; Returns: boolean }
      is_teacher: { Args: never; Returns: boolean }
      is_tenant_admin:
        | { Args: { p_tenant_id: string; p_user_id: string }; Returns: boolean }
        | { Args: { p_user_id: string }; Returns: boolean }
      my_class_ids: { Args: never; Returns: string[] }
      my_student_ids: { Args: never; Returns: string[] }
    }
    Enums: {
      billing_status: "unbilled" | "pending" | "charged" | "waived" | "disputed"
      user_role:
        | "super_admin"
        | "admin"
        | "teacher"
        | "parent"
        | "student"
        | "front_desk"
      user_role_type:
        | "super_admin"
        | "studio_admin"
        | "finance_admin"
        | "finance_lead"
        | "studio_manager"
        | "teacher"
        | "front_desk"
        | "parent"
        | "student"
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
      billing_status: ["unbilled", "pending", "charged", "waived", "disputed"],
      user_role: [
        "super_admin",
        "admin",
        "teacher",
        "parent",
        "student",
        "front_desk",
      ],
      user_role_type: [
        "super_admin",
        "studio_admin",
        "finance_admin",
        "finance_lead",
        "studio_manager",
        "teacher",
        "front_desk",
        "parent",
        "student",
      ],
    },
  },
} as const
