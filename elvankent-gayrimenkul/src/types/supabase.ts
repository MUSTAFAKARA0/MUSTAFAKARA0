// Bu dosya otomatik üretilir: npm run db:types — elle düzenlemeyin.

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
      appointments: {
        Row: {
          id: string
          organization_id: string
          property_id: string | null
          customer_id: string
          lead_id: string | null
          scheduled_at: string
          duration_minutes: number
          status: Database["public"]["Enums"]["appointment_status"]
          note: string | null
          assigned_to: string | null
          confirmed_at: string | null
          completed_at: string | null
          cancelled_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          property_id?: string | null
          customer_id: string
          lead_id?: string | null
          scheduled_at: string
          duration_minutes?: number
          status?: Database["public"]["Enums"]["appointment_status"]
          note?: string | null
          assigned_to?: string | null
          confirmed_at?: string | null
          completed_at?: string | null
          cancelled_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          property_id?: string | null
          customer_id?: string
          lead_id?: string | null
          scheduled_at?: string
          duration_minutes?: number
          status?: Database["public"]["Enums"]["appointment_status"]
          note?: string | null
          assigned_to?: string | null
          confirmed_at?: string | null
          completed_at?: string | null
          cancelled_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          id: number
          organization_id: string | null
          actor_id: string | null
          actor_label: string | null
          action: string
          target_type: string | null
          target_id: string | null
          target_label: string | null
          metadata: Json
          ip_hash: string | null
          created_at: string
        }
        Insert: {
          id?: never
          organization_id?: string | null
          actor_id?: string | null
          actor_label?: string | null
          action: string
          target_type?: string | null
          target_id?: string | null
          target_label?: string | null
          metadata?: Json
          ip_hash?: string | null
          created_at?: string
        }
        Update: {
          id?: never
          organization_id?: string | null
          actor_id?: string | null
          actor_label?: string | null
          action?: string
          target_type?: string | null
          target_id?: string | null
          target_label?: string | null
          metadata?: Json
          ip_hash?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          id: number
          name: string
          slug: string
          latitude: number | null
          longitude: number | null
          created_at: string
          code: string | null
        }
        Insert: {
          id?: number
          name: string
          slug: string
          latitude?: number | null
          longitude?: number | null
          created_at?: string
          code?: string | null
        }
        Update: {
          id?: number
          name?: string
          slug?: string
          latitude?: number | null
          longitude?: number | null
          created_at?: string
          code?: string | null
        }
        Relationships: []
      }
      collection_items: {
        Row: {
          collection_id: string
          property_id: string
          organization_id: string
          sort_order: number
          note: string | null
          created_at: string
        }
        Insert: {
          collection_id: string
          property_id: string
          organization_id: string
          sort_order?: number
          note?: string | null
          created_at?: string
        }
        Update: {
          collection_id?: string
          property_id?: string
          organization_id?: string
          sort_order?: number
          note?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          id: string
          organization_id: string
          customer_id: string | null
          title: string
          message: string | null
          token: string
          expires_at: string | null
          revoked_at: string | null
          view_count: number
          last_viewed_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          customer_id?: string | null
          title: string
          message?: string | null
          token: string
          expires_at?: string | null
          revoked_at?: string | null
          view_count?: number
          last_viewed_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          customer_id?: string | null
          title?: string
          message?: string | null
          token?: string
          expires_at?: string | null
          revoked_at?: string | null
          view_count?: number
          last_viewed_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          id: string
          organization_id: string
          full_name: string
          phone: string | null
          phone_key: string | null
          email: string | null
          notes: string | null
          source: Database["public"]["Enums"]["lead_source"]
          kvkk_consent_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          full_name: string
          phone?: string | null
          phone_key?: never
          email?: string | null
          notes?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          kvkk_consent_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          full_name?: string
          phone?: string | null
          phone_key?: never
          email?: string | null
          notes?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          kvkk_consent_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      design_family_settings: {
        Row: {
          family_id: string
          enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          family_id: string
          enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          family_id?: string
          enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      districts: {
        Row: {
          id: number
          city_id: number
          name: string
          slug: string
          latitude: number | null
          longitude: number | null
          created_at: string
          code: string | null
        }
        Insert: {
          id?: number
          city_id: number
          name: string
          slug: string
          latitude?: number | null
          longitude?: number | null
          created_at?: string
          code?: string | null
        }
        Update: {
          id?: number
          city_id?: number
          name?: string
          slug?: string
          latitude?: number | null
          longitude?: number | null
          created_at?: string
          code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "districts_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          user_id: string
          property_id: string
          created_at: string
          organization_id: string
        }
        Insert: {
          user_id: string
          property_id: string
          created_at?: string
          organization_id: string
        }
        Update: {
          user_id?: string
          property_id?: string
          created_at?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      features: {
        Row: {
          id: number
          key: string
          label: string
          feature_group: string
          sort_order: number
        }
        Insert: {
          id?: number
          key: string
          label: string
          feature_group: string
          sort_order?: number
        }
        Update: {
          id?: number
          key?: string
          label?: string
          feature_group?: string
          sort_order?: number
        }
        Relationships: []
      }
      lead_activities: {
        Row: {
          id: number
          organization_id: string
          lead_id: string
          kind: Database["public"]["Enums"]["lead_activity_kind"]
          body: string | null
          metadata: Json
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: never
          organization_id: string
          lead_id: string
          kind: Database["public"]["Enums"]["lead_activity_kind"]
          body?: string | null
          metadata?: Json
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: never
          organization_id?: string
          lead_id?: string
          kind?: Database["public"]["Enums"]["lead_activity_kind"]
          body?: string | null
          metadata?: Json
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          id: string
          organization_id: string
          customer_id: string
          property_id: string | null
          status: Database["public"]["Enums"]["lead_status"]
          source: Database["public"]["Enums"]["lead_source"]
          intent: Database["public"]["Enums"]["lead_intent"] | null
          message: string | null
          budget_min: number | null
          budget_max: number | null
          currency: Database["public"]["Enums"]["currency_code"]
          desired_location: string | null
          details: Json
          assigned_to: string | null
          next_follow_up_at: string | null
          closed_at: string | null
          ip_hash: string | null
          user_agent: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          customer_id: string
          property_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          source?: Database["public"]["Enums"]["lead_source"]
          intent?: Database["public"]["Enums"]["lead_intent"] | null
          message?: string | null
          budget_min?: number | null
          budget_max?: number | null
          currency?: Database["public"]["Enums"]["currency_code"]
          desired_location?: string | null
          details?: Json
          assigned_to?: string | null
          next_follow_up_at?: string | null
          closed_at?: string | null
          ip_hash?: string | null
          user_agent?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          customer_id?: string
          property_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          source?: Database["public"]["Enums"]["lead_source"]
          intent?: Database["public"]["Enums"]["lead_intent"] | null
          message?: string | null
          budget_min?: number | null
          budget_max?: number | null
          currency?: Database["public"]["Enums"]["currency_code"]
          desired_location?: string | null
          details?: Json
          assigned_to?: string | null
          next_follow_up_at?: string | null
          closed_at?: string | null
          ip_hash?: string | null
          user_agent?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          id: string
          property_id: string | null
          legacy_path: string | null
          width: number | null
          height: number | null
          blur_data_url: string | null
          alt_text: string | null
          sort_order: number
          is_cover: boolean
          created_at: string
          organization_id: string
          kind: Database["public"]["Enums"]["media_kind"]
          status: Database["public"]["Enums"]["media_status"]
          original_path: string | null
          public_base: string | null
          variant_widths: number[]
          mime_type: string | null
          byte_size: number | null
          variants_byte_size: number
          original_filename: string | null
          error: string | null
          created_by: string | null
          processed_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          property_id?: string | null
          legacy_path?: string | null
          width?: number | null
          height?: number | null
          blur_data_url?: string | null
          alt_text?: string | null
          sort_order?: number
          is_cover?: boolean
          created_at?: string
          organization_id: string
          kind?: Database["public"]["Enums"]["media_kind"]
          status?: Database["public"]["Enums"]["media_status"]
          original_path?: string | null
          public_base?: string | null
          variant_widths?: number[]
          mime_type?: string | null
          byte_size?: number | null
          variants_byte_size?: number
          original_filename?: string | null
          error?: string | null
          created_by?: string | null
          processed_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          property_id?: string | null
          legacy_path?: string | null
          width?: number | null
          height?: number | null
          blur_data_url?: string | null
          alt_text?: string | null
          sort_order?: number
          is_cover?: boolean
          created_at?: string
          organization_id?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          status?: Database["public"]["Enums"]["media_status"]
          original_path?: string | null
          public_base?: string | null
          variant_widths?: number[]
          mime_type?: string | null
          byte_size?: number | null
          variants_byte_size?: number
          original_filename?: string | null
          error?: string | null
          created_by?: string | null
          processed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      neighborhoods: {
        Row: {
          id: number
          district_id: number
          name: string
          slug: string
          latitude: number | null
          longitude: number | null
          created_at: string
          code: string | null
        }
        Insert: {
          id?: number
          district_id: number
          name: string
          slug: string
          latitude?: number | null
          longitude?: number | null
          created_at?: string
          code?: string | null
        }
        Update: {
          id?: number
          district_id?: number
          name?: string
          slug?: string
          latitude?: number | null
          longitude?: number | null
          created_at?: string
          code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "neighborhoods_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          id: string
          organization_id: string
          channel: string
          event: string
          lead_id: string | null
          recipients: string[]
          status: string
          provider: string
          provider_message_id: string | null
          error: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          channel: string
          event: string
          lead_id?: string | null
          recipients?: string[]
          status: string
          provider: string
          provider_message_id?: string | null
          error?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          channel?: string
          event?: string
          lead_id?: string | null
          recipients?: string[]
          status?: string
          provider?: string
          provider_message_id?: string | null
          error?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_counters: {
        Row: {
          organization_id: string
          scope: string
          period: number
          value: number
        }
        Insert: {
          organization_id: string
          scope: string
          period: number
          value?: number
        }
        Update: {
          organization_id?: string
          scope?: string
          period?: number
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "organization_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_design_families: {
        Row: {
          organization_id: string
          family_id: string
          granted_by: string | null
          granted_at: string
        }
        Insert: {
          organization_id: string
          family_id: string
          granted_by?: string | null
          granted_at?: string
        }
        Update: {
          organization_id?: string
          family_id?: string
          granted_by?: string | null
          granted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_design_families_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_domains: {
        Row: {
          id: string
          organization_id: string
          hostname: string
          is_primary: boolean
          verified_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          hostname: string
          is_primary?: boolean
          verified_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          hostname?: string
          is_primary?: boolean
          verified_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_domains_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          organization_id: string
          user_id: string
          role: Database["public"]["Enums"]["org_role"]
          status: Database["public"]["Enums"]["member_status"]
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          organization_id: string
          user_id: string
          role: Database["public"]["Enums"]["org_role"]
          status?: Database["public"]["Enums"]["member_status"]
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          organization_id?: string
          user_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          status?: Database["public"]["Enums"]["member_status"]
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_notification_settings: {
        Row: {
          organization_id: string
          notify_new_lead: boolean
          emails: string[]
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          organization_id: string
          notify_new_lead?: boolean
          emails?: string[]
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          organization_id?: string
          notify_new_lead?: boolean
          emails?: string[]
          updated_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_notification_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          organization_id: string
          display_name: string
          legal_name: string | null
          tagline: string | null
          description: string | null
          service_area: string | null
          logo_url: string | null
          favicon_url: string | null
          primary_color: string
          accent_color: string
          phone: string | null
          whatsapp: string | null
          email: string | null
          address_line: string | null
          address_district: string | null
          address_city: string | null
          postal_code: string | null
          office_latitude: number | null
          office_longitude: number | null
          opening_hours: Json
          working_hours_note: string | null
          instagram_url: string | null
          facebook_url: string | null
          x_url: string | null
          youtube_url: string | null
          linkedin_url: string | null
          tiktok_url: string | null
          seo_title: string | null
          seo_description: string | null
          og_image_url: string | null
          google_site_verification: string | null
          hero_title: string | null
          hero_subtitle: string | null
          hero_image_url: string | null
          default_location_precision: Database["public"]["Enums"]["location_precision"]
          updated_by: string | null
          updated_at: string
          short_name: string | null
          logo_mobile_url: string | null
          maps_url: string | null
        }
        Insert: {
          organization_id: string
          display_name: string
          legal_name?: string | null
          tagline?: string | null
          description?: string | null
          service_area?: string | null
          logo_url?: string | null
          favicon_url?: string | null
          primary_color?: string
          accent_color?: string
          phone?: string | null
          whatsapp?: string | null
          email?: string | null
          address_line?: string | null
          address_district?: string | null
          address_city?: string | null
          postal_code?: string | null
          office_latitude?: number | null
          office_longitude?: number | null
          opening_hours?: Json
          working_hours_note?: string | null
          instagram_url?: string | null
          facebook_url?: string | null
          x_url?: string | null
          youtube_url?: string | null
          linkedin_url?: string | null
          tiktok_url?: string | null
          seo_title?: string | null
          seo_description?: string | null
          og_image_url?: string | null
          google_site_verification?: string | null
          hero_title?: string | null
          hero_subtitle?: string | null
          hero_image_url?: string | null
          default_location_precision?: Database["public"]["Enums"]["location_precision"]
          updated_by?: string | null
          updated_at?: string
          short_name?: string | null
          logo_mobile_url?: string | null
          maps_url?: string | null
        }
        Update: {
          organization_id?: string
          display_name?: string
          legal_name?: string | null
          tagline?: string | null
          description?: string | null
          service_area?: string | null
          logo_url?: string | null
          favicon_url?: string | null
          primary_color?: string
          accent_color?: string
          phone?: string | null
          whatsapp?: string | null
          email?: string | null
          address_line?: string | null
          address_district?: string | null
          address_city?: string | null
          postal_code?: string | null
          office_latitude?: number | null
          office_longitude?: number | null
          opening_hours?: Json
          working_hours_note?: string | null
          instagram_url?: string | null
          facebook_url?: string | null
          x_url?: string | null
          youtube_url?: string | null
          linkedin_url?: string | null
          tiktok_url?: string | null
          seo_title?: string | null
          seo_description?: string | null
          og_image_url?: string | null
          google_site_verification?: string | null
          hero_title?: string | null
          hero_subtitle?: string | null
          hero_image_url?: string | null
          default_location_precision?: Database["public"]["Enums"]["location_precision"]
          updated_by?: string | null
          updated_at?: string
          short_name?: string | null
          logo_mobile_url?: string | null
          maps_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          id: string
          slug: string
          name: string
          reference_prefix: string
          status: Database["public"]["Enums"]["org_status"]
          is_default: boolean
          created_at: string
          updated_at: string
          require_admin_mfa: boolean
        }
        Insert: {
          id?: string
          slug: string
          name: string
          reference_prefix: string
          status?: Database["public"]["Enums"]["org_status"]
          is_default?: boolean
          created_at?: string
          updated_at?: string
          require_admin_mfa?: boolean
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          reference_prefix?: string
          status?: Database["public"]["Enums"]["org_status"]
          is_default?: boolean
          created_at?: string
          updated_at?: string
          require_admin_mfa?: boolean
        }
        Relationships: []
      }
      pages: {
        Row: {
          id: string
          organization_id: string
          key: string
          title: string
          body: string
          seo_title: string | null
          seo_description: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
          legal_reviewed: boolean
        }
        Insert: {
          id?: string
          organization_id: string
          key: string
          title: string
          body: string
          seo_title?: string | null
          seo_description?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
          legal_reviewed?: boolean
        }
        Update: {
          id?: string
          organization_id?: string
          key?: string
          title?: string
          body?: string
          seo_title?: string | null
          seo_description?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
          legal_reviewed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          id: string
          name: string
          description: string | null
          max_users: number | null
          max_properties: number | null
          max_storage_mb: number | null
          crm_enabled: boolean
          analytics_enabled: boolean
          pdf_enabled: boolean
          custom_domain_enabled: boolean
          price_monthly: number | null
          currency: Database["public"]["Enums"]["currency_code"]
          is_public: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          description?: string | null
          max_users?: number | null
          max_properties?: number | null
          max_storage_mb?: number | null
          crm_enabled?: boolean
          analytics_enabled?: boolean
          pdf_enabled?: boolean
          custom_domain_enabled?: boolean
          price_monthly?: number | null
          currency?: Database["public"]["Enums"]["currency_code"]
          is_public?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          max_users?: number | null
          max_properties?: number | null
          max_storage_mb?: number | null
          crm_enabled?: boolean
          analytics_enabled?: boolean
          pdf_enabled?: boolean
          custom_domain_enabled?: boolean
          price_monthly?: number | null
          currency?: Database["public"]["Enums"]["currency_code"]
          is_public?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_leads: {
        Row: {
          id: string
          created_at: string
          kind: string
          full_name: string
          email: string | null
          phone: string | null
          company: string | null
          city: string | null
          message: string | null
          kvkk_consent: boolean
          status: string
          note: string | null
          handled_by: string | null
          handled_at: string | null
          ip_hash: string | null
          user_agent: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          kind?: string
          full_name: string
          email?: string | null
          phone?: string | null
          company?: string | null
          city?: string | null
          message?: string | null
          kvkk_consent: boolean
          status?: string
          note?: string | null
          handled_by?: string | null
          handled_at?: string | null
          ip_hash?: string | null
          user_agent?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          kind?: string
          full_name?: string
          email?: string | null
          phone?: string | null
          company?: string | null
          city?: string | null
          message?: string | null
          kvkk_consent?: boolean
          status?: string
          note?: string | null
          handled_by?: string | null
          handled_at?: string | null
          ip_hash?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          id: boolean
          company_name: string
          tagline: string | null
          contact_email: string | null
          contact_phone: string | null
          whatsapp: string | null
          address: string | null
          city: string | null
          website_url: string | null
          linkedin_url: string | null
          instagram_url: string | null
          x_url: string | null
          youtube_url: string | null
          seo_title: string | null
          seo_description: string | null
          indexable: boolean
          lead_notify_emails: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          company_name?: string
          tagline?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          whatsapp?: string | null
          address?: string | null
          city?: string | null
          website_url?: string | null
          linkedin_url?: string | null
          instagram_url?: string | null
          x_url?: string | null
          youtube_url?: string | null
          seo_title?: string | null
          seo_description?: string | null
          indexable?: boolean
          lead_notify_emails?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          company_name?: string
          tagline?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          whatsapp?: string | null
          address?: string | null
          city?: string | null
          website_url?: string | null
          linkedin_url?: string | null
          instagram_url?: string | null
          x_url?: string | null
          youtube_url?: string | null
          seo_title?: string | null
          seo_description?: string | null
          indexable?: boolean
          lead_notify_emails?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      posts: {
        Row: {
          id: string
          organization_id: string
          slug: string
          title: string
          excerpt: string | null
          body: string
          cover_media_id: string | null
          status: Database["public"]["Enums"]["content_status"]
          published_at: string | null
          seo_title: string | null
          seo_description: string | null
          author_id: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          slug: string
          title: string
          excerpt?: string | null
          body?: string
          cover_media_id?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          published_at?: string | null
          seo_title?: string | null
          seo_description?: string | null
          author_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          slug?: string
          title?: string
          excerpt?: string | null
          body?: string
          cover_media_id?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          published_at?: string | null
          seo_title?: string | null
          seo_description?: string | null
          author_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_cover_media_id_fkey"
            columns: ["cover_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          phone: string | null
          created_at: string
          updated_at: string
          is_super_admin: boolean
          password_change_required: boolean
        }
        Insert: {
          id: string
          full_name?: string | null
          phone?: string | null
          created_at?: string
          updated_at?: string
          is_super_admin?: boolean
          password_change_required?: boolean
        }
        Update: {
          id?: string
          full_name?: string | null
          phone?: string | null
          created_at?: string
          updated_at?: string
          is_super_admin?: boolean
          password_change_required?: boolean
        }
        Relationships: []
      }
      properties: {
        Row: {
          id: string
          slug: string
          title: string
          description: string | null
          listing_type: Database["public"]["Enums"]["listing_type"]
          property_type_id: number
          category: Database["public"]["Enums"]["property_category"]
          status: Database["public"]["Enums"]["listing_status"]
          is_featured: boolean
          is_demo: boolean
          price: number | null
          currency: Database["public"]["Enums"]["currency_code"]
          price_negotiable: boolean
          dues: number | null
          deposit: number | null
          city_id: number | null
          district_id: number | null
          neighborhood_id: number | null
          public_latitude: number | null
          public_longitude: number | null
          location_precision: Database["public"]["Enums"]["location_precision"]
          gross_m2: number | null
          net_m2: number | null
          room_count: number | null
          living_room_count: number | null
          rooms_label: string | null
          building_age: number | null
          floor: string | null
          total_floors: number | null
          bathroom_count: number | null
          balcony_count: number | null
          heating: string | null
          has_elevator: boolean | null
          parking: string | null
          is_furnished: boolean | null
          in_complex: boolean | null
          complex_name: string | null
          has_air_conditioning: boolean | null
          credit_eligible: boolean | null
          deed_status: string | null
          usage_status: string | null
          facades: string[]
          views: string[]
          swap_available: boolean | null
          zoning_status: string | null
          block_no: string | null
          parcel_no: string | null
          floor_area_ratio: number | null
          height_limit: string | null
          seo_description: string | null
          published_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          organization_id: string
          reference_no: string
          deleted_at: string | null
          deleted_by: string | null
          updated_by: string | null
          status_changed_at: string | null
          show_on_homepage: boolean
          investment_suitable: boolean | null
          seo_title: string | null
          price_previous: number | null
          price_changed_at: string | null
          price_dropped_at: string | null
          floor_position: string | null
          og_media_id: string | null
        }
        Insert: {
          id?: string
          slug: string
          title: string
          description?: string | null
          listing_type: Database["public"]["Enums"]["listing_type"]
          property_type_id: number
          category: Database["public"]["Enums"]["property_category"]
          status?: Database["public"]["Enums"]["listing_status"]
          is_featured?: boolean
          is_demo?: boolean
          price?: number | null
          currency?: Database["public"]["Enums"]["currency_code"]
          price_negotiable?: boolean
          dues?: number | null
          deposit?: number | null
          city_id?: number | null
          district_id?: number | null
          neighborhood_id?: number | null
          public_latitude?: number | null
          public_longitude?: number | null
          location_precision?: Database["public"]["Enums"]["location_precision"]
          gross_m2?: number | null
          net_m2?: number | null
          room_count?: number | null
          living_room_count?: number | null
          rooms_label?: never
          building_age?: number | null
          floor?: string | null
          total_floors?: number | null
          bathroom_count?: number | null
          balcony_count?: number | null
          heating?: string | null
          has_elevator?: boolean | null
          parking?: string | null
          is_furnished?: boolean | null
          in_complex?: boolean | null
          complex_name?: string | null
          has_air_conditioning?: boolean | null
          credit_eligible?: boolean | null
          deed_status?: string | null
          usage_status?: string | null
          facades?: string[]
          views?: string[]
          swap_available?: boolean | null
          zoning_status?: string | null
          block_no?: string | null
          parcel_no?: string | null
          floor_area_ratio?: number | null
          height_limit?: string | null
          seo_description?: string | null
          published_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          organization_id: string
          reference_no: string
          deleted_at?: string | null
          deleted_by?: string | null
          updated_by?: string | null
          status_changed_at?: string | null
          show_on_homepage?: boolean
          investment_suitable?: boolean | null
          seo_title?: string | null
          price_previous?: number | null
          price_changed_at?: string | null
          price_dropped_at?: string | null
          floor_position?: never
          og_media_id?: string | null
        }
        Update: {
          id?: string
          slug?: string
          title?: string
          description?: string | null
          listing_type?: Database["public"]["Enums"]["listing_type"]
          property_type_id?: number
          category?: Database["public"]["Enums"]["property_category"]
          status?: Database["public"]["Enums"]["listing_status"]
          is_featured?: boolean
          is_demo?: boolean
          price?: number | null
          currency?: Database["public"]["Enums"]["currency_code"]
          price_negotiable?: boolean
          dues?: number | null
          deposit?: number | null
          city_id?: number | null
          district_id?: number | null
          neighborhood_id?: number | null
          public_latitude?: number | null
          public_longitude?: number | null
          location_precision?: Database["public"]["Enums"]["location_precision"]
          gross_m2?: number | null
          net_m2?: number | null
          room_count?: number | null
          living_room_count?: number | null
          rooms_label?: never
          building_age?: number | null
          floor?: string | null
          total_floors?: number | null
          bathroom_count?: number | null
          balcony_count?: number | null
          heating?: string | null
          has_elevator?: boolean | null
          parking?: string | null
          is_furnished?: boolean | null
          in_complex?: boolean | null
          complex_name?: string | null
          has_air_conditioning?: boolean | null
          credit_eligible?: boolean | null
          deed_status?: string | null
          usage_status?: string | null
          facades?: string[]
          views?: string[]
          swap_available?: boolean | null
          zoning_status?: string | null
          block_no?: string | null
          parcel_no?: string | null
          floor_area_ratio?: number | null
          height_limit?: string | null
          seo_description?: string | null
          published_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          organization_id?: string
          reference_no?: string
          deleted_at?: string | null
          deleted_by?: string | null
          updated_by?: string | null
          status_changed_at?: string | null
          show_on_homepage?: boolean
          investment_suitable?: boolean | null
          seo_title?: string | null
          price_previous?: number | null
          price_changed_at?: string | null
          price_dropped_at?: string | null
          floor_position?: never
          og_media_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_og_media_id_fkey"
            columns: ["og_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_property_type_id_fkey"
            columns: ["property_type_id"]
            isOneToOne: false
            referencedRelation: "property_types"
            referencedColumns: ["id"]
          },
        ]
      }
      property_events: {
        Row: {
          id: number
          property_id: string
          event_type: Database["public"]["Enums"]["property_event_type"]
          session_hash: string | null
          created_at: string
          organization_id: string
        }
        Insert: {
          id?: never
          property_id: string
          event_type: Database["public"]["Enums"]["property_event_type"]
          session_hash?: string | null
          created_at?: string
          organization_id: string
        }
        Update: {
          id?: never
          property_id?: string
          event_type?: Database["public"]["Enums"]["property_event_type"]
          session_hash?: string | null
          created_at?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_features: {
        Row: {
          property_id: string
          feature_id: number
          organization_id: string
        }
        Insert: {
          property_id: string
          feature_id: number
          organization_id: string
        }
        Update: {
          property_id?: string
          feature_id?: number
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_features_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_features_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_locations: {
        Row: {
          property_id: string
          address: string | null
          latitude: number | null
          longitude: number | null
          precision: Database["public"]["Enums"]["location_precision"]
          updated_at: string
          organization_id: string
        }
        Insert: {
          property_id: string
          address?: string | null
          latitude?: number | null
          longitude?: number | null
          precision?: Database["public"]["Enums"]["location_precision"]
          updated_at?: string
          organization_id: string
        }
        Update: {
          property_id?: string
          address?: string | null
          latitude?: number | null
          longitude?: number | null
          precision?: Database["public"]["Enums"]["location_precision"]
          updated_at?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_locations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_price_history: {
        Row: {
          id: number
          organization_id: string
          property_id: string
          old_price: number | null
          new_price: number
          currency: Database["public"]["Enums"]["currency_code"]
          changed_by: string | null
          changed_at: string
        }
        Insert: {
          id?: never
          organization_id: string
          property_id: string
          old_price?: number | null
          new_price: number
          currency: Database["public"]["Enums"]["currency_code"]
          changed_by?: string | null
          changed_at?: string
        }
        Update: {
          id?: never
          organization_id?: string
          property_id?: string
          old_price?: number | null
          new_price?: number
          currency?: Database["public"]["Enums"]["currency_code"]
          changed_by?: string | null
          changed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_price_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_price_history_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_stats: {
        Row: {
          property_id: string
          view_count: number
          phone_click_count: number
          whatsapp_click_count: number
          contact_form_count: number
          favorite_count: number
          share_count: number
          organization_id: string
        }
        Insert: {
          property_id: string
          view_count?: number
          phone_click_count?: number
          whatsapp_click_count?: number
          contact_form_count?: number
          favorite_count?: number
          share_count?: number
          organization_id: string
        }
        Update: {
          property_id?: string
          view_count?: number
          phone_click_count?: number
          whatsapp_click_count?: number
          contact_form_count?: number
          favorite_count?: number
          share_count?: number
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_stats_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_stats_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_types: {
        Row: {
          id: number
          category: Database["public"]["Enums"]["property_category"]
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          id?: number
          category: Database["public"]["Enums"]["property_category"]
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          id?: number
          category?: Database["public"]["Enums"]["property_category"]
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      redirects: {
        Row: {
          id: number
          from_path: string
          to_path: string
          status_code: number
          created_at: string
          organization_id: string
        }
        Insert: {
          id?: never
          from_path: string
          to_path: string
          status_code?: number
          created_at?: string
          organization_id: string
        }
        Update: {
          id?: never
          from_path?: string
          to_path?: string
          status_code?: number
          created_at?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "redirects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      region_pages: {
        Row: {
          id: string
          organization_id: string
          slug: string
          name: string
          city_id: number
          district_id: number | null
          neighborhood_id: number | null
          intro: string | null
          body: string
          faqs: Json
          seo_title: string | null
          seo_description: string | null
          status: Database["public"]["Enums"]["content_status"]
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          slug: string
          name: string
          city_id: number
          district_id?: number | null
          neighborhood_id?: number | null
          intro?: string | null
          body?: string
          faqs?: Json
          seo_title?: string | null
          seo_description?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          slug?: string
          name?: string
          city_id?: number
          district_id?: number | null
          neighborhood_id?: number | null
          intro?: string | null
          body?: string
          faqs?: Json
          seo_title?: string | null
          seo_description?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "region_pages_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "region_pages_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "region_pages_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "region_pages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          role: Database["public"]["Enums"]["org_role"]
          permission: string
        }
        Insert: {
          role: Database["public"]["Enums"]["org_role"]
          permission: string
        }
        Update: {
          role?: Database["public"]["Enums"]["org_role"]
          permission?: string
        }
        Relationships: []
      }
      site_config_revisions: {
        Row: {
          id: string
          organization_id: string
          version: number
          config: Json
          note: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          version: number
          config: Json
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          version?: number
          config?: Json
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_config_revisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      site_configs: {
        Row: {
          organization_id: string
          draft: Json
          published: Json
          published_version: number
          has_unpublished_changes: boolean
          site_status: string
          maintenance_message: string | null
          feature_overrides: Json
          draft_updated_at: string | null
          draft_updated_by: string | null
          published_at: string | null
          published_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          organization_id: string
          draft?: Json
          published?: Json
          published_version?: number
          has_unpublished_changes?: boolean
          site_status?: string
          maintenance_message?: string | null
          feature_overrides?: Json
          draft_updated_at?: string | null
          draft_updated_by?: string | null
          published_at?: string | null
          published_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          organization_id?: string
          draft?: Json
          published?: Json
          published_version?: number
          has_unpublished_changes?: boolean
          site_status?: string
          maintenance_message?: string | null
          feature_overrides?: Json
          draft_updated_at?: string | null
          draft_updated_by?: string | null
          published_at?: string | null
          published_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          id: string
          organization_id: string
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          started_at: string
          trial_ends_at: string | null
          renewal_at: string | null
          cancelled_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          started_at?: string
          trial_ends_at?: string | null
          renewal_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          started_at?: string
          trial_ends_at?: string | null
          renewal_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      active_org_ids: {
        Args: never
        Returns: string[]
      }
      assert_super_admin: {
        Args: never
        Returns: undefined
      }
      audit_actor_label: {
        Args: {
          p_user: string
        }
        Returns: string
      }
      audit_changed_fields: {
        Args: {
          p_old: Json
          p_new: Json
        }
        Returns: string[]
      }
      bulk_property_action: {
        Args: {
          p_ids: string[]
          p_action: string
        }
        Returns: Json
      }
      clear_password_change_required: {
        Args: never
        Returns: undefined
      }
      get_public_collection: {
        Args: {
          p_token: string
        }
        Returns: Json
      }
      has_org_permission: {
        Args: {
          p_org: string
          p_permission: string
        }
        Returns: boolean
      }
      is_super_admin: {
        Args: never
        Returns: boolean
      }
      list_org_members: {
        Args: {
          p_org: string
        }
        Returns: {
          user_id: string
          full_name: string
          email: string
          role: Database["public"]["Enums"]["org_role"]
          status: Database["public"]["Enums"]["member_status"]
          created_at: string
          last_sign_in_at: string
          password_change_required: boolean
        }[]
      }
      log_security_event: {
        Args: {
          p_org: string
          p_action: string
          p_actor: string
          p_target_type: string
          p_target_id: string
          p_target_label: string
          p_metadata: Json
          p_ip_hash: string
        }
        Returns: undefined
      }
      media_upload_allowed: {
        Args: {
          p_org: string
          p_bytes: number
        }
        Returns: boolean
      }
      member_org_ids: {
        Args: never
        Returns: string[]
      }
      next_org_counter: {
        Args: {
          p_org: string
          p_scope: string
          p_period: number
        }
        Returns: number
      }
      org_dashboard: {
        Args: {
          p_org: string
          p_days?: number
        }
        Returns: Json
      }
      org_design_family_access: {
        Args: {
          p_org: string
        }
        Returns: {
          family_id: string
        }[]
      }
      org_member_mfa_status: {
        Args: {
          p_org: string
        }
        Returns: {
          user_id: string
          mfa_enabled: boolean
        }[]
      }
      org_plan: {
        Args: {
          p_org: string
        }
        Returns: {
          plan_id: string
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          max_users: number
          max_properties: number
          max_storage_mb: number
          crm_enabled: boolean
          analytics_enabled: boolean
          pdf_enabled: boolean
          custom_domain_enabled: boolean
        }[]
      }
      org_usage: {
        Args: {
          p_org: string
        }
        Returns: Json
      }
      platform_add_domain: {
        Args: {
          p_org: string
          p_hostname: string
          p_primary?: boolean
        }
        Returns: string
      }
      platform_create_organization: {
        Args: {
          p_slug: string
          p_name: string
          p_prefix: string
          p_plan: string
          p_owner: string
        }
        Returns: string
      }
      platform_organizations: {
        Args: never
        Returns: {
          id: string
          slug: string
          name: string
          reference_prefix: string
          status: Database["public"]["Enums"]["org_status"]
          is_default: boolean
          created_at: string
          plan_id: string
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          renewal_at: string
          trial_ends_at: string
          member_count: number
          property_count: number
          published_count: number
          storage_bytes: number
          leads_30d: number
          last_activity_at: string
          primary_domain: string
        }[]
      }
      platform_remove_domain: {
        Args: {
          p_id: string
        }
        Returns: undefined
      }
      platform_set_design_family: {
        Args: {
          p_family: string
          p_enabled: boolean
        }
        Returns: undefined
      }
      platform_set_org_design_families: {
        Args: {
          p_org: string
          p_families: string[]
        }
        Returns: undefined
      }
      platform_set_org_plan: {
        Args: {
          p_org: string
          p_plan: string
          p_status?: Database["public"]["Enums"]["subscription_status"]
        }
        Returns: undefined
      }
      platform_set_org_status: {
        Args: {
          p_org: string
          p_status: Database["public"]["Enums"]["org_status"]
        }
        Returns: undefined
      }
      platform_sites: {
        Args: never
        Returns: {
          organization_id: string
          slug: string
          name: string
          org_status: Database["public"]["Enums"]["org_status"]
          is_default: boolean
          site_status: string
          published_version: number
          has_unpublished_changes: boolean
          published_at: string
          draft_updated_at: string
          theme: string
          primary_domain: string
          logo_url: string
        }[]
      }
      platform_update_lead: {
        Args: {
          p_id: string
          p_status: string
          p_note?: string
        }
        Returns: undefined
      }
      platform_update_plan: {
        Args: {
          p_id: string
          p_name: string
          p_max_users: number
          p_max_properties: number
          p_max_storage_mb: number
          p_crm: boolean
          p_analytics: boolean
          p_pdf: boolean
          p_custom_domain: boolean
          p_price: number
        }
        Returns: undefined
      }
      platform_users: {
        Args: {
          p_search?: string
          p_limit?: number
        }
        Returns: {
          user_id: string
          email: string
          full_name: string
          is_super_admin: boolean
          created_at: string
          last_sign_in_at: string
          memberships: Json
        }[]
      }
      public_platform_profile: {
        Args: never
        Returns: {
          company_name: string
          tagline: string
          contact_email: string
          contact_phone: string
          whatsapp: string
          address: string
          city: string
          website_url: string
          linkedin_url: string
          instagram_url: string
          x_url: string
          youtube_url: string
          seo_title: string
          seo_description: string
          indexable: boolean
        }[]
      }
      public_site_config: {
        Args: {
          p_org: string
        }
        Returns: {
          published: Json
          published_version: number
          site_status: string
          maintenance_message: string
          feature_overrides: Json
        }[]
      }
      public_tenant: {
        Args: {
          p_slug?: string
          p_hostname?: string
        }
        Returns: {
          id: string
          slug: string
          name: string
          is_default: boolean
          reference_prefix: string
          status: Database["public"]["Enums"]["org_status"]
        }[]
      }
      public_tenant_domains: {
        Args: {
          p_org: string
        }
        Returns: {
          hostname: string
          is_primary: boolean
        }[]
      }
      public_tenant_settings: {
        Args: {
          p_org: string
        }
        Returns: Database["public"]["Tables"]["organization_settings"]["Row"][]
      }
      purge_old_audit_logs: {
        Args: {
          p_days?: number
        }
        Returns: number
      }
      region_listing_counts: {
        Args: {
          p_org: string
        }
        Returns: {
          city_slug: string
          city_name: string
          district_slug: string
          district_name: string
          neighborhood_slug: string
          neighborhood_name: string
          listing_count: number
        }[]
      }
      region_price_stats: {
        Args: {
          p_org: string
          p_city: number
          p_district?: number
          p_neighborhood?: number
        }
        Returns: {
          listing_type: Database["public"]["Enums"]["listing_type"]
          currency: Database["public"]["Enums"]["currency_code"]
          listing_count: number
          min_price: number
          median_price: number
          max_price: number
          median_price_per_m2: number
        }[]
      }
      reorder_property_media: {
        Args: {
          p_property_id: string
          p_ids: string[]
        }
        Returns: undefined
      }
      session_aal: {
        Args: never
        Returns: string
      }
      session_context: {
        Args: {
          p_preferred_org?: string
          p_host_key?: string
        }
        Returns: Json
      }
      set_property_cover: {
        Args: {
          p_media_id: string
        }
        Returns: undefined
      }
      set_require_admin_mfa: {
        Args: {
          p_org: string
          p_value: boolean
        }
        Returns: undefined
      }
      similar_properties: {
        Args: {
          p_property_id: string
          p_limit?: number
        }
        Returns: {
          id: string
          score: number
        }[]
      }
      site_apply_brand: {
        Args: {
          p_org: string
          p_brand: Json
        }
        Returns: undefined
      }
      site_apply_design: {
        Args: {
          p_org: string
          p_family: string
          p_sections: Json
        }
        Returns: number
      }
      site_brand_columns: {
        Args: never
        Returns: string[]
      }
      site_brand_snapshot: {
        Args: {
          p_org: string
        }
        Returns: Json
      }
      site_discard_draft: {
        Args: {
          p_org: string
        }
        Returns: undefined
      }
      site_publish: {
        Args: {
          p_org: string
          p_note?: string
        }
        Returns: number
      }
      site_rollback: {
        Args: {
          p_org: string
          p_version: number
        }
        Returns: number
      }
      site_save_draft: {
        Args: {
          p_expected_updated_at?: string
          p_org: string
          p_section: string
          p_value: Json
        }
        Returns: string
      }
      site_set_features: {
        Args: {
          p_org: string
          p_overrides: Json
        }
        Returns: undefined
      }
      site_set_status: {
        Args: {
          p_org: string
          p_status: string
          p_message?: string
        }
        Returns: undefined
      }
      slugify: {
        Args: {
          p_text: string
        }
        Returns: string
      }
      stale_media: {
        Args: {
          p_older_than?: string
        }
        Returns: {
          id: string
          organization_id: string
          original_path: string
          public_base: string
          variant_widths: number[]
        }[]
      }
      submit_lead: {
        Args: {
          p_org: string
          p_full_name: string
          p_phone: string
          p_email: string
          p_message: string
          p_property_id: string
          p_source: Database["public"]["Enums"]["lead_source"]
          p_intent: Database["public"]["Enums"]["lead_intent"]
          p_details: Json
          p_appointment_at: string
          p_kvkk_consent: boolean
          p_ip_hash: string
          p_user_agent: string
        }
        Returns: string
      }
      submit_platform_lead: {
        Args: {
          p_kind: string
          p_full_name: string
          p_email: string
          p_phone: string
          p_company: string
          p_city: string
          p_message: string
          p_kvkk_consent: boolean
          p_ip_hash: string
          p_user_agent: string
        }
        Returns: string
      }
      track_event: {
        Args: {
          p_property_id: string
          p_event: Database["public"]["Enums"]["property_event_type"]
          p_session_hash: string
        }
        Returns: boolean
      }
      unique_slug: {
        Args: {
          p_table: string
          p_org: string
          p_slug: string
          p_id: string
        }
        Returns: string
      }
      user_has_mfa: {
        Args: never
        Returns: boolean
      }
      user_org_ids: {
        Args: {
          p_permission?: string
        }
        Returns: string[]
      }
      write_audit: {
        Args: {
          p_org: string
          p_action: string
          p_target_type: string
          p_target_id: string
          p_target_label: string
          p_metadata?: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      appointment_status: "requested" | "confirmed" | "completed" | "cancelled"
      content_status: "draft" | "published"
      currency_code: "TRY" | "USD" | "EUR"
      lead_activity_kind: "note" | "status_change" | "call" | "whatsapp" | "email" | "meeting" | "system"
      lead_intent: "buy" | "rent" | "sell" | "let" | "valuation" | "other"
      lead_source: "website" | "whatsapp" | "phone" | "listing" | "contact_form" | "appointment" | "manual" | "qr"
      lead_status: "new" | "contacted" | "meeting" | "appointment" | "follow_up" | "closed" | "cancelled"
      listing_status: "draft" | "pending" | "published" | "archived" | "sold" | "rented"
      listing_type: "sale" | "rent"
      location_precision: "exact" | "approximate" | "neighborhood"
      media_kind: "property_photo" | "post_cover" | "general"
      media_status: "pending" | "ready" | "failed"
      member_status: "active" | "disabled"
      org_role: "owner" | "admin" | "agent" | "editor" | "viewer"
      org_status: "active" | "suspended" | "cancelled"
      property_category: "konut" | "ticari" | "arsa" | "diger"
      property_event_type: "view" | "phone_click" | "whatsapp_click" | "contact_form" | "favorite_add" | "share" | "appointment_request" | "qr_visit" | "compare_add"
      subscription_status: "trialing" | "active" | "past_due" | "cancelled" | "expired"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
export type FunctionReturns<T extends keyof PublicSchema["Functions"]> = PublicSchema["Functions"][T]["Returns"]
