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
      ab_test_results: {
        Row: {
          clicks: number | null
          created_at: string
          engagement_rate: number | null
          engagements: number | null
          id: string
          impressions: number | null
          post_id: string
          recorded_at: string
          shares: number | null
          variant_id: string
        }
        Insert: {
          clicks?: number | null
          created_at?: string
          engagement_rate?: number | null
          engagements?: number | null
          id?: string
          impressions?: number | null
          post_id: string
          recorded_at?: string
          shares?: number | null
          variant_id: string
        }
        Update: {
          clicks?: number | null
          created_at?: string
          engagement_rate?: number | null
          engagements?: number | null
          id?: string
          impressions?: number | null
          post_id?: string
          recorded_at?: string
          shares?: number | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ab_test_results_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_test_results_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "post_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_title: string | null
          entity_type: string
          id: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_title?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_title?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      agent_skills: {
        Row: {
          agent_type: string
          created_at: string | null
          id: string
          is_active: boolean | null
          marca: string | null
          skill_id: string
          skill_tags: string[] | null
          skill_version: string | null
          system_prompt: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          agent_type: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          marca?: string | null
          skill_id: string
          skill_tags?: string[] | null
          skill_version?: string | null
          system_prompt: string
          updated_at?: string | null
          workspace_id?: string
        }
        Update: {
          agent_type?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          marca?: string | null
          skill_id?: string
          skill_tags?: string[] | null
          skill_version?: string | null
          system_prompt?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      ai_agent_prompt_versions: {
        Row: {
          agent_type: string
          change_reason: string | null
          changed_by: string | null
          created_at: string
          id: string
          model_config: Json | null
          prompt_id: string
          system_prompt: string
          version_number: number
          workspace_id: string
        }
        Insert: {
          agent_type: string
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          model_config?: Json | null
          prompt_id: string
          system_prompt: string
          version_number?: number
          workspace_id: string
        }
        Update: {
          agent_type?: string
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          model_config?: Json | null
          prompt_id?: string
          system_prompt?: string
          version_number?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_prompt_versions_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_prompt_versions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_prompts: {
        Row: {
          agent_type: string
          auto_updated_at: string | null
          avoid_section: string | null
          company: string | null
          created_at: string
          id: string
          is_active: boolean | null
          last_updated_by: string | null
          model_config: Json | null
          prefer_section: string | null
          system_prompt: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agent_type: string
          auto_updated_at?: string | null
          avoid_section?: string | null
          company?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_updated_by?: string | null
          model_config?: Json | null
          prefer_section?: string | null
          system_prompt?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agent_type?: string
          auto_updated_at?: string | null
          avoid_section?: string | null
          company?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_updated_by?: string | null
          model_config?: Json | null
          prefer_section?: string | null
          system_prompt?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      ai_content_suggestions: {
        Row: {
          angle: string | null
          caption_draft: string | null
          confidence: number | null
          created_at: string
          created_post_id: string | null
          format: string | null
          hook: string | null
          id: string
          idea_title: string
          objective: string | null
          status: string | null
          workspace_id: string
        }
        Insert: {
          angle?: string | null
          caption_draft?: string | null
          confidence?: number | null
          created_at?: string
          created_post_id?: string | null
          format?: string | null
          hook?: string | null
          id?: string
          idea_title: string
          objective?: string | null
          status?: string | null
          workspace_id: string
        }
        Update: {
          angle?: string | null
          caption_draft?: string | null
          confidence?: number | null
          created_at?: string
          created_post_id?: string | null
          format?: string | null
          hook?: string | null
          id?: string
          idea_title?: string
          objective?: string | null
          status?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_content_suggestions_created_post_id_fkey"
            columns: ["created_post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_content_suggestions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_post_insights: {
        Row: {
          created_at: string
          extracted_hooks: string[] | null
          hypotheses: string[] | null
          id: string
          performance_score: number | null
          post_id: string
          recommended_edits: string[] | null
          strengths: string[] | null
          suggested_hashtags: string[] | null
          summary: string | null
          weaknesses: string[] | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          extracted_hooks?: string[] | null
          hypotheses?: string[] | null
          id?: string
          performance_score?: number | null
          post_id: string
          recommended_edits?: string[] | null
          strengths?: string[] | null
          suggested_hashtags?: string[] | null
          summary?: string | null
          weaknesses?: string[] | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          extracted_hooks?: string[] | null
          hypotheses?: string[] | null
          id?: string
          performance_score?: number | null
          post_id?: string
          recommended_edits?: string[] | null
          strengths?: string[] | null
          suggested_hashtags?: string[] | null
          summary?: string | null
          weaknesses?: string[] | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_post_insights_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_post_insights_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompt_adjustments: {
        Row: {
          caption_avoid_list: string[] | null
          caption_prefer_list: string[] | null
          common_issues: Json | null
          created_at: string
          id: string
          image_avoid_list: string[] | null
          image_prefer_list: string[] | null
          last_analysis_at: string | null
          total_rejections_analyzed: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          caption_avoid_list?: string[] | null
          caption_prefer_list?: string[] | null
          common_issues?: Json | null
          created_at?: string
          id?: string
          image_avoid_list?: string[] | null
          image_prefer_list?: string[] | null
          last_analysis_at?: string | null
          total_rejections_analyzed?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          caption_avoid_list?: string[] | null
          caption_prefer_list?: string[] | null
          common_issues?: Json | null
          created_at?: string
          id?: string
          image_avoid_list?: string[] | null
          image_prefer_list?: string[] | null
          last_analysis_at?: string | null
          total_rejections_analyzed?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_prompt_adjustments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_trend_playbook: {
        Row: {
          avg_save_rate: number | null
          best_formats: string[] | null
          best_posting_times: string[] | null
          created_at: string
          do_list: string[] | null
          dont_list: string[] | null
          id: string
          prompt_master: string | null
          top_hashtags: string[] | null
          updated_at: string
          winning_patterns: Json | null
          workspace_id: string
        }
        Insert: {
          avg_save_rate?: number | null
          best_formats?: string[] | null
          best_posting_times?: string[] | null
          created_at?: string
          do_list?: string[] | null
          dont_list?: string[] | null
          id?: string
          prompt_master?: string | null
          top_hashtags?: string[] | null
          updated_at?: string
          winning_patterns?: Json | null
          workspace_id: string
        }
        Update: {
          avg_save_rate?: number | null
          best_formats?: string[] | null
          best_posting_times?: string[] | null
          created_at?: string
          do_list?: string[] | null
          dont_list?: string[] | null
          id?: string
          prompt_master?: string | null
          top_hashtags?: string[] | null
          updated_at?: string
          winning_patterns?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_trend_playbook_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      approvers: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string
          type: Database["public"]["Enums"]["approver_type"]
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          name: string
          type?: Database["public"]["Enums"]["approver_type"]
          workspace_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          type?: Database["public"]["Enums"]["approver_type"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          author_id: string | null
          brand: string | null
          category_id: string | null
          content: string | null
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          keywords: string[] | null
          location: string | null
          meta_description: string | null
          published_at: string | null
          reading_time: number | null
          slug: string
          status: string
          tags: string[] | null
          title: string
          updated_at: string
          view_count: number | null
        }
        Insert: {
          author_id?: string | null
          brand?: string | null
          category_id?: string | null
          content?: string | null
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          keywords?: string[] | null
          location?: string | null
          meta_description?: string | null
          published_at?: string | null
          reading_time?: number | null
          slug: string
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          view_count?: number | null
        }
        Update: {
          author_id?: string | null
          brand?: string | null
          category_id?: string | null
          content?: string | null
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          keywords?: string[] | null
          location?: string | null
          meta_description?: string | null
          published_at?: string | null
          reading_time?: number | null
          slug?: string
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_schedules: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          id: string
          interval_unit: string
          interval_value: number
          is_active: boolean
          last_run_at: string | null
          next_run_at: string | null
          posts_generated_this_week: number
          runs_this_week: number
          updated_at: string
          workflow_name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          interval_unit?: string
          interval_value?: number
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string | null
          posts_generated_this_week?: number
          runs_this_week?: number
          updated_at?: string
          workflow_name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          interval_unit?: string
          interval_value?: number
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string | null
          posts_generated_this_week?: number
          runs_this_week?: number
          updated_at?: string
          workflow_name?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      email_profiles: {
        Row: {
          created_at: string
          id: string
          name: string
          settings: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          settings?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          settings?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          config: Json | null
          created_at: string
          id: string
          is_active: boolean
          type: Database["public"]["Enums"]["integration_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          type: Database["public"]["Enums"]["integration_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          type?: Database["public"]["Enums"]["integration_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_blog_content: {
        Row: {
          created_at: string | null
          id: string
          inserted_at: string | null
          link: string
          message: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          inserted_at?: string | null
          link: string
          message?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          inserted_at?: string | null
          link?: string
          message?: string | null
          status?: string
        }
        Relationships: []
      }
      newsletter_campaigns: {
        Row: {
          content: string | null
          created_at: string
          failed_count: number | null
          id: string
          recipient_count: number | null
          scheduled_at: string | null
          segments: string[] | null
          sent_at: string | null
          sent_count: number | null
          status: Database["public"]["Enums"]["campaign_status"]
          subject: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          failed_count?: number | null
          id?: string
          recipient_count?: number | null
          scheduled_at?: string | null
          segments?: string[] | null
          sent_at?: string | null
          sent_count?: number | null
          status?: Database["public"]["Enums"]["campaign_status"]
          subject: string
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          failed_count?: number | null
          id?: string
          recipient_count?: number | null
          scheduled_at?: string | null
          segments?: string[] | null
          sent_at?: string | null
          sent_count?: number | null
          status?: Database["public"]["Enums"]["campaign_status"]
          subject?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      newsletter_segments: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          subscriber_count: number | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          subscriber_count?: number | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          subscriber_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          email: string
          engagement_score: number | null
          id: string
          is_active: boolean | null
          name: string | null
          preferences: Json | null
          segments: string[] | null
          source: string | null
          subscribed_at: string
        }
        Insert: {
          email: string
          engagement_score?: number | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          preferences?: Json | null
          segments?: string[] | null
          source?: string | null
          subscribed_at?: string
        }
        Update: {
          email?: string
          engagement_score?: number | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          preferences?: Json | null
          segments?: string[] | null
          source?: string | null
          subscribed_at?: string
        }
        Relationships: []
      }
      pautas: {
        Row: {
          briefing: string
          created_at: string
          data_criacao: string
          data_prevista: string | null
          id: number
          link_referencia: string | null
          marca: string | null
          observacoes: string | null
          plataforma: string | null
          status: string
          titulo: string
          updated_at: string
          vertical: string | null
        }
        Insert: {
          briefing?: string
          created_at?: string
          data_criacao?: string
          data_prevista?: string | null
          id?: never
          link_referencia?: string | null
          marca?: string | null
          observacoes?: string | null
          plataforma?: string | null
          status?: string
          titulo: string
          updated_at?: string
          vertical?: string | null
        }
        Update: {
          briefing?: string
          created_at?: string
          data_criacao?: string
          data_prevista?: string | null
          id?: never
          link_referencia?: string | null
          marca?: string | null
          observacoes?: string | null
          plataforma?: string | null
          status?: string
          titulo?: string
          updated_at?: string
          vertical?: string | null
        }
        Relationships: []
      }
      post_analytics: {
        Row: {
          channel: string
          clicks: number | null
          comments: number | null
          created_at: string
          engagement_rate: number | null
          engagements: number | null
          id: string
          impressions: number | null
          insights_source: string | null
          likes: number | null
          plays: number | null
          post_id: string
          reach: number | null
          recorded_at: string
          recorded_date: string
          saves: number | null
          shares: number | null
        }
        Insert: {
          channel: string
          clicks?: number | null
          comments?: number | null
          created_at?: string
          engagement_rate?: number | null
          engagements?: number | null
          id?: string
          impressions?: number | null
          insights_source?: string | null
          likes?: number | null
          plays?: number | null
          post_id: string
          reach?: number | null
          recorded_at?: string
          recorded_date?: string
          saves?: number | null
          shares?: number | null
        }
        Update: {
          channel?: string
          clicks?: number | null
          comments?: number | null
          created_at?: string
          engagement_rate?: number | null
          engagements?: number | null
          id?: string
          impressions?: number | null
          insights_source?: string | null
          likes?: number | null
          plays?: number | null
          post_id?: string
          reach?: number | null
          recorded_at?: string
          recorded_date?: string
          saves?: number | null
          shares?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_analytics_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_approvals: {
        Row: {
          action: Database["public"]["Enums"]["approval_action"]
          approver_email: string | null
          approver_id: string | null
          approver_name: string | null
          comment: string | null
          created_at: string
          id: string
          is_external: boolean
          post_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["approval_action"]
          approver_email?: string | null
          approver_id?: string | null
          approver_name?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          is_external?: boolean
          post_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["approval_action"]
          approver_email?: string | null
          approver_id?: string | null
          approver_name?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          is_external?: boolean
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_approvals_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          author_email: string | null
          author_id: string | null
          author_name: string | null
          content: string
          created_at: string
          id: string
          is_internal: boolean
          post_id: string
        }
        Insert: {
          author_email?: string | null
          author_id?: string | null
          author_name?: string | null
          content: string
          created_at?: string
          id?: string
          is_internal?: boolean
          post_id: string
        }
        Update: {
          author_email?: string | null
          author_id?: string | null
          author_name?: string | null
          content?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_generation_status: {
        Row: {
          created_at: string | null
          error_message: string | null
          generation_id: string
          id: string
          post_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          generation_id: string
          id?: string
          post_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          generation_id?: string
          id?: string
          post_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      post_templates: {
        Row: {
          category: string | null
          channels: Database["public"]["Enums"]["social_channel"][]
          content: string | null
          created_at: string
          description: string | null
          excerpt: string | null
          id: string
          is_public: boolean | null
          media_urls: string[] | null
          name: string
          tags: string[] | null
          updated_at: string
          usage_count: number | null
          workspace_id: string
        }
        Insert: {
          category?: string | null
          channels?: Database["public"]["Enums"]["social_channel"][]
          content?: string | null
          created_at?: string
          description?: string | null
          excerpt?: string | null
          id?: string
          is_public?: boolean | null
          media_urls?: string[] | null
          name: string
          tags?: string[] | null
          updated_at?: string
          usage_count?: number | null
          workspace_id: string
        }
        Update: {
          category?: string | null
          channels?: Database["public"]["Enums"]["social_channel"][]
          content?: string | null
          created_at?: string
          description?: string | null
          excerpt?: string | null
          id?: string
          is_public?: boolean | null
          media_urls?: string[] | null
          name?: string
          tags?: string[] | null
          updated_at?: string
          usage_count?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      post_variants: {
        Row: {
          content: string | null
          created_at: string
          id: string
          is_winner: boolean | null
          media_urls: string[] | null
          performance_score: number | null
          post_id: string
          updated_at: string
          variant_name: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          is_winner?: boolean | null
          media_urls?: string[] | null
          performance_score?: number | null
          post_id: string
          updated_at?: string
          variant_name?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          is_winner?: boolean | null
          media_urls?: string[] | null
          performance_score?: number | null
          post_id?: string
          updated_at?: string
          variant_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_variants_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_versions: {
        Row: {
          content: string | null
          created_at: string
          created_by: string | null
          id: string
          media_urls: string[] | null
          post_id: string
          version_number: number
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          media_urls?: string[] | null
          post_id: string
          version_number: number
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          media_urls?: string[] | null
          post_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_versions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string | null
          id: string
          is_approved: boolean | null
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_approved?: boolean | null
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_approved?: boolean | null
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rejection_reasons: {
        Row: {
          additional_comment: string | null
          channel: string | null
          created_at: string
          created_by: string | null
          id: string
          post_content: string | null
          post_format: string | null
          post_id: string
          reasons: string[]
          workspace_id: string
        }
        Insert: {
          additional_comment?: string | null
          channel?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          post_content?: string | null
          post_format?: string | null
          post_id: string
          reasons?: string[]
          workspace_id: string
        }
        Update: {
          additional_comment?: string | null
          channel?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          post_content?: string | null
          post_format?: string | null
          post_id?: string
          reasons?: string[]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rejection_reasons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rejection_reasons_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rejection_reasons_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      social_connections: {
        Row: {
          access_token: string
          account_id: string
          account_name: string | null
          account_username: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          last_error: string | null
          last_used_at: string | null
          page_id: string | null
          page_name: string | null
          profile_picture_url: string | null
          provider: string
          refresh_token: string | null
          scopes: string[] | null
          token_expires_at: string | null
          updated_at: string | null
          workspace_id: string
          zapier_channel: string | null
          zapier_webhook_url: string | null
        }
        Insert: {
          access_token: string
          account_id: string
          account_name?: string | null
          account_username?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_used_at?: string | null
          page_id?: string | null
          page_name?: string | null
          profile_picture_url?: string | null
          provider: string
          refresh_token?: string | null
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string | null
          workspace_id: string
          zapier_channel?: string | null
          zapier_webhook_url?: string | null
        }
        Update: {
          access_token?: string
          account_id?: string
          account_name?: string | null
          account_username?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_used_at?: string | null
          page_id?: string | null
          page_name?: string | null
          profile_picture_url?: string | null
          provider?: string
          refresh_token?: string | null
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string | null
          workspace_id?: string
          zapier_channel?: string | null
          zapier_webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          approval_token: string | null
          author_id: string | null
          channels: Database["public"]["Enums"]["social_channel"][]
          company: string | null
          content: string | null
          created_at: string
          excerpt: string | null
          facebook_post_id: string | null
          has_ab_test: boolean | null
          id: string
          image_urls: string[] | null
          instagram_media_id: string | null
          linkedin_post_urn: string | null
          media_urls: string[] | null
          n8n_workflow_id: string | null
          og_image_url: string | null
          origem: string | null
          pauta_id: number | null
          published_at: string | null
          scheduled_at: string | null
          seo_description: string | null
          seo_keywords: string[] | null
          seo_title: string | null
          status: Database["public"]["Enums"]["post_status"]
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          approval_token?: string | null
          author_id?: string | null
          channels?: Database["public"]["Enums"]["social_channel"][]
          company?: string | null
          content?: string | null
          created_at?: string
          excerpt?: string | null
          facebook_post_id?: string | null
          has_ab_test?: boolean | null
          id?: string
          image_urls?: string[] | null
          instagram_media_id?: string | null
          linkedin_post_urn?: string | null
          media_urls?: string[] | null
          n8n_workflow_id?: string | null
          og_image_url?: string | null
          origem?: string | null
          pauta_id?: number | null
          published_at?: string | null
          scheduled_at?: string | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          approval_token?: string | null
          author_id?: string | null
          channels?: Database["public"]["Enums"]["social_channel"][]
          company?: string | null
          content?: string | null
          created_at?: string
          excerpt?: string | null
          facebook_post_id?: string | null
          has_ab_test?: boolean | null
          id?: string
          image_urls?: string[] | null
          instagram_media_id?: string | null
          linkedin_post_urn?: string | null
          media_urls?: string[] | null
          n8n_workflow_id?: string | null
          og_image_url?: string | null
          origem?: string | null
          pauta_id?: number | null
          published_at?: string | null
          scheduled_at?: string | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_pauta_id_fkey"
            columns: ["pauta_id"]
            isOneToOne: false
            referencedRelation: "pautas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tts_audio_cache: {
        Row: {
          article_id: string
          created_at: string | null
          duration_seconds: number | null
          id: string
          storage_path: string
          text_hash: string
          updated_at: string | null
        }
        Insert: {
          article_id: string
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          storage_path: string
          text_hash: string
          updated_at?: string | null
        }
        Update: {
          article_id?: string
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          storage_path?: string
          text_hash?: string
          updated_at?: string | null
        }
        Relationships: []
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
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_post_by_token: {
        Args: { _token: string }
        Returns: {
          channels: Database["public"]["Enums"]["social_channel"][]
          content: string
          excerpt: string
          id: string
          media_urls: string[]
          scheduled_at: string
          status: Database["public"]["Enums"]["post_status"]
          title: string
          workspace_name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      submit_external_approval: {
        Args: {
          _action: Database["public"]["Enums"]["approval_action"]
          _approver_email?: string
          _approver_name?: string
          _comment?: string
          _token: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      approval_action: "approved" | "changes_requested"
      approver_type: "internal" | "external"
      campaign_status:
        | "draft"
        | "scheduled"
        | "sending"
        | "sent"
        | "sent_with_errors"
        | "failed"
      integration_type: "slack" | "whatsapp" | "instagram_api" | "n8n"
      post_status:
        | "DRAFT"
        | "IN_REVIEW_INTERNAL"
        | "IN_REVIEW_EXTERNAL"
        | "CHANGES_REQUESTED"
        | "APPROVED"
        | "SCHEDULED"
        | "PUBLISHED"
      social_channel: "instagram" | "facebook" | "linkedin" | "twitter" | "blog"
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
      app_role: ["admin", "moderator", "user"],
      approval_action: ["approved", "changes_requested"],
      approver_type: ["internal", "external"],
      campaign_status: [
        "draft",
        "scheduled",
        "sending",
        "sent",
        "sent_with_errors",
        "failed",
      ],
      integration_type: ["slack", "whatsapp", "instagram_api", "n8n"],
      post_status: [
        "DRAFT",
        "IN_REVIEW_INTERNAL",
        "IN_REVIEW_EXTERNAL",
        "CHANGES_REQUESTED",
        "APPROVED",
        "SCHEDULED",
        "PUBLISHED",
      ],
      social_channel: ["instagram", "facebook", "linkedin", "twitter", "blog"],
    },
  },
} as const
