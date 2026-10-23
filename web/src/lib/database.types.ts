// Gegenereerd uit de live database (Supabase MCP generate_typescript_types, 16 oktober 2026). Niet met de hand
// aanpassen: opnieuw genereren na een migratie (van de helpers onderaan is alleen `Tables` bewaard).
// Aanvullingen staan in supabase-browser.ts.

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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string
          email: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      app_logs: {
        Row: {
          context: Json
          id: number
          level: string
          message: string
          source: string
          ts: string
        }
        Insert: {
          context?: Json
          id?: never
          level: string
          message: string
          source: string
          ts?: string
        }
        Update: {
          context?: Json
          id?: never
          level?: string
          message?: string
          source?: string
          ts?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor: string | null
          actor_email: string | null
          details: Json
          entity: string
          entity_id: string | null
          id: number
          ts: string
        }
        Insert: {
          action: string
          actor?: string | null
          actor_email?: string | null
          details?: Json
          entity: string
          entity_id?: string | null
          id?: never
          ts?: string
        }
        Update: {
          action?: string
          actor?: string | null
          actor_email?: string | null
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: never
          ts?: string
        }
        Relationships: []
      }
      consent_log: {
        Row: {
          analytics: boolean
          consent_id: string
          id: number
          marketing: boolean
          ts: string
          version: string
        }
        Insert: {
          analytics: boolean
          consent_id: string
          id?: never
          marketing: boolean
          ts?: string
          version: string
        }
        Update: {
          analytics?: boolean
          consent_id?: string
          id?: never
          marketing?: boolean
          ts?: string
          version?: string
        }
        Relationships: []
      }
      crowd_reports: {
        Row: {
          created_at: string
          id: number
          level: string
          place_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          level: string
          place_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          level?: string
          place_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crowd_reports_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      crowd_watches: {
        Row: {
          created_at: string
          expires_at: string
          notified_at: string | null
          place_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          notified_at?: string | null
          place_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          notified_at?: string | null
          place_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crowd_watches_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      duplicate_dismissals: {
        Row: {
          a: string
          b: string
          created_at: string
          dismissed_by: string | null
        }
        Insert: {
          a: string
          b: string
          created_at?: string
          dismissed_by?: string | null
        }
        Update: {
          a?: string
          b?: string
          created_at?: string
          dismissed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "duplicate_dismissals_a_fkey"
            columns: ["a"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_dismissals_b_fkey"
            columns: ["b"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          id: number
          name: string
          path: string | null
          props: Json
          session_id: string | null
          ts: string
        }
        Insert: {
          id?: never
          name: string
          path?: string | null
          props?: Json
          session_id?: string | null
          ts?: string
        }
        Update: {
          id?: never
          name?: string
          path?: string | null
          props?: Json
          session_id?: string | null
          ts?: string
        }
        Relationships: []
      }
      faq: {
        Row: {
          answer: string
          category: string
          id: string
          position: number
          published: boolean
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          category: string
          id?: string
          position?: number
          published?: boolean
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string
          id?: string
          position?: number
          published?: boolean
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      ingest_runs: {
        Row: {
          finished_at: string | null
          id: number
          kind: string
          started_at: string
          stats: Json
          status: string
        }
        Insert: {
          finished_at?: string | null
          id?: never
          kind: string
          started_at?: string
          stats?: Json
          status?: string
        }
        Update: {
          finished_at?: string | null
          id?: never
          kind?: string
          started_at?: string
          stats?: Json
          status?: string
        }
        Relationships: []
      }
      internal_secrets: {
        Row: {
          name: string
          value: string
        }
        Insert: {
          name: string
          value: string
        }
        Update: {
          name?: string
          value?: string
        }
        Relationships: []
      }
      nl_towns: {
        Row: {
          id: number
          lat: number
          lng: number
          name: string
          province: string
        }
        Insert: {
          id?: number
          lat: number
          lng: number
          name: string
          province: string
        }
        Update: {
          id?: number
          lat?: number
          lng?: number
          name?: string
          province?: string
        }
        Relationships: []
      }
      osm_queries: {
        Row: {
          name: string
          template: string
        }
        Insert: {
          name: string
          template: string
        }
        Update: {
          name?: string
          template?: string
        }
        Relationships: []
      }
      osm_regions: {
        Row: {
          attempt: number
          code: string
          last_run_at: string | null
          name: string
          places_req: number | null
          points_req: number | null
        }
        Insert: {
          attempt?: number
          code: string
          last_run_at?: string | null
          name: string
          places_req?: number | null
          points_req?: number | null
        }
        Update: {
          attempt?: number
          code?: string
          last_run_at?: string | null
          name?: string
          places_req?: number | null
          points_req?: number | null
        }
        Relationships: []
      }
      osm_staging: {
        Row: {
          created_at: string
          id: number
          kind: string
          processed_at: string | null
          row: Json
        }
        Insert: {
          created_at?: string
          id?: never
          kind: string
          processed_at?: string | null
          row: Json
        }
        Update: {
          created_at?: string
          id?: never
          kind?: string
          processed_at?: string | null
          row?: Json
        }
        Relationships: []
      }
      place_photos: {
        Row: {
          caption: string | null
          created_at: string
          credit: string | null
          height: number | null
          id: string
          place_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          storage_path: string
          user_id: string | null
          width: number | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          credit?: string | null
          height?: number | null
          id?: string
          place_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path: string
          user_id?: string | null
          width?: number | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          credit?: string | null
          height?: number | null
          id?: string
          place_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path?: string
          user_id?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "place_photos_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          access_24h: boolean | null
          access_hours: string | null
          capacity: number | null
          checkin_from: string | null
          checkin_until: string | null
          checkout_until: string | null
          completeness: number
          created_at: string
          departure: string | null
          departure_check: string | null
          departure_checked_at: string | null
          departure_checked_by: string | null
          description: string | null
          description_source: string | null
          dogs: boolean | null
          dump_station: boolean | null
          email: string | null
          geom: unknown
          id: string
          image_credit: string | null
          image_url: string | null
          kind: string | null
          last_scraped_at: string | null
          lat: number
          lng: number
          max_length_m: number | null
          max_stay_nights: number | null
          merged_into: string | null
          name: string
          name_is_generic: boolean
          open_all_year: boolean | null
          osm_id: number | null
          osm_type: string | null
          phone: string | null
          photos: Json
          postcode: string | null
          power: boolean | null
          power_note: string | null
          price_eur: number | null
          price_extras: Json | null
          price_note: string | null
          province: string | null
          rating_avg: number | null
          rating_count: number
          reservation: boolean | null
          reservation_rule: string | null
          season: string | null
          shower: boolean | null
          slug: string
          sources: Json
          status: string
          status_locked: boolean
          street: string | null
          surface: string | null
          times_note: string | null
          toilet: boolean | null
          tourist_tax_included: boolean | null
          town: string | null
          updated_at: string
          verified_at: string | null
          water: boolean | null
          website: string | null
          wifi: boolean | null
        }
        Insert: {
          access_24h?: boolean | null
          access_hours?: string | null
          capacity?: number | null
          checkin_from?: string | null
          checkin_until?: string | null
          checkout_until?: string | null
          completeness?: number
          created_at?: string
          departure?: string | null
          departure_check?: string | null
          departure_checked_at?: string | null
          departure_checked_by?: string | null
          description?: string | null
          description_source?: string | null
          dogs?: boolean | null
          dump_station?: boolean | null
          email?: string | null
          geom?: unknown
          id?: string
          image_credit?: string | null
          image_url?: string | null
          kind?: string | null
          last_scraped_at?: string | null
          lat: number
          lng: number
          max_length_m?: number | null
          max_stay_nights?: number | null
          merged_into?: string | null
          name: string
          name_is_generic?: boolean
          open_all_year?: boolean | null
          osm_id?: number | null
          osm_type?: string | null
          phone?: string | null
          photos?: Json
          postcode?: string | null
          power?: boolean | null
          power_note?: string | null
          price_eur?: number | null
          price_extras?: Json | null
          price_note?: string | null
          province?: string | null
          rating_avg?: number | null
          rating_count?: number
          reservation?: boolean | null
          reservation_rule?: string | null
          season?: string | null
          shower?: boolean | null
          slug: string
          sources?: Json
          status?: string
          status_locked?: boolean
          street?: string | null
          surface?: string | null
          times_note?: string | null
          toilet?: boolean | null
          tourist_tax_included?: boolean | null
          town?: string | null
          updated_at?: string
          verified_at?: string | null
          water?: boolean | null
          website?: string | null
          wifi?: boolean | null
        }
        Update: {
          access_24h?: boolean | null
          access_hours?: string | null
          capacity?: number | null
          checkin_from?: string | null
          checkin_until?: string | null
          checkout_until?: string | null
          completeness?: number
          created_at?: string
          departure?: string | null
          departure_check?: string | null
          departure_checked_at?: string | null
          departure_checked_by?: string | null
          description?: string | null
          description_source?: string | null
          dogs?: boolean | null
          dump_station?: boolean | null
          email?: string | null
          geom?: unknown
          id?: string
          image_credit?: string | null
          image_url?: string | null
          kind?: string | null
          last_scraped_at?: string | null
          lat?: number
          lng?: number
          max_length_m?: number | null
          max_stay_nights?: number | null
          merged_into?: string | null
          name?: string
          name_is_generic?: boolean
          open_all_year?: boolean | null
          osm_id?: number | null
          osm_type?: string | null
          phone?: string | null
          photos?: Json
          postcode?: string | null
          power?: boolean | null
          power_note?: string | null
          price_eur?: number | null
          price_extras?: Json | null
          price_note?: string | null
          province?: string | null
          rating_avg?: number | null
          rating_count?: number
          reservation?: boolean | null
          reservation_rule?: string | null
          season?: string | null
          shower?: boolean | null
          slug?: string
          sources?: Json
          status?: string
          status_locked?: boolean
          street?: string | null
          surface?: string | null
          times_note?: string | null
          toilet?: boolean | null
          tourist_tax_included?: boolean | null
          town?: string | null
          updated_at?: string
          verified_at?: string | null
          water?: boolean | null
          website?: string | null
          wifi?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "places_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          disabled_at: string | null
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          disabled_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          disabled_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          admin_note: string | null
          author_email: string | null
          author_name: string
          body: string
          created_at: string
          id: string
          place_id: string
          rating: number
          score_facilities: number | null
          score_location: number | null
          score_quiet: number | null
          score_value: number | null
          status: string
          title: string | null
          user_id: string | null
          vehicle: string | null
          visited_month: string | null
        }
        Insert: {
          admin_note?: string | null
          author_email?: string | null
          author_name: string
          body: string
          created_at?: string
          id?: string
          place_id: string
          rating: number
          score_facilities?: number | null
          score_location?: number | null
          score_quiet?: number | null
          score_value?: number | null
          status?: string
          title?: string | null
          user_id?: string | null
          vehicle?: string | null
          visited_month?: string | null
        }
        Update: {
          admin_note?: string | null
          author_email?: string | null
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          place_id?: string
          rating?: number
          score_facilities?: number | null
          score_location?: number | null
          score_quiet?: number | null
          score_value?: number | null
          status?: string
          title?: string | null
          user_id?: string | null
          vehicle?: string | null
          visited_month?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      route_cache: {
        Row: {
          created_at: string
          distance_m: number
          duration_s: number
          geometry: Json | null
          key: string
          provider: string
        }
        Insert: {
          created_at?: string
          distance_m: number
          duration_s: number
          geometry?: Json | null
          key: string
          provider: string
        }
        Update: {
          created_at?: string
          distance_m?: number
          duration_s?: number
          geometry?: Json | null
          key?: string
          provider?: string
        }
        Relationships: []
      }
      shared_trip_members: {
        Row: {
          display_name: string | null
          joined_at: string
          left_at: string | null
          trip_id: string
          user_id: string
        }
        Insert: {
          display_name?: string | null
          joined_at?: string
          left_at?: string | null
          trip_id: string
          user_id: string
        }
        Update: {
          display_name?: string | null
          joined_at?: string
          left_at?: string | null
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "shared_trips"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_trips: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          name: string
          owner_id: string
          stops: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
          owner_id: string
          stops?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
          owner_id?: string
          stops?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          value: Json
        }
        Insert: {
          key: string
          value: Json
        }
        Update: {
          key?: string
          value?: Json
        }
        Relationships: []
      }
      submissions: {
        Row: {
          admin_note: string | null
          contact_email: string | null
          contact_name: string | null
          created_at: string
          id: string
          kind: string
          payload: Json
          place_id: string | null
          status: string
        }
        Insert: {
          admin_note?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          kind: string
          payload: Json
          place_id?: string | null
          status?: string
        }
        Update: {
          admin_note?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          place_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          admin_id: string | null
          author: string
          body: string
          created_at: string
          id: string
          internal: boolean
          ticket_id: string
        }
        Insert: {
          admin_id?: string | null
          author: string
          body: string
          created_at?: string
          id?: string
          internal?: boolean
          ticket_id: string
        }
        Update: {
          admin_id?: string | null
          author?: string
          body?: string
          created_at?: string
          id?: string
          internal?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          access_token: string
          assignee: string | null
          category: string
          created_at: string
          email: string
          id: string
          name: string
          number: number
          place_id: string | null
          priority: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          access_token?: string
          assignee?: string | null
          category?: string
          created_at?: string
          email: string
          id?: string
          name: string
          number?: never
          place_id?: string | null
          priority?: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          assignee?: string | null
          category?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          number?: never
          place_id?: string | null
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assignee_fkey"
            columns: ["assignee"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tickets_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      user_expenses: {
        Row: {
          entries: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          entries?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          entries?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_trips: {
        Row: {
          stops: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          stops?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          stops?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_vehicles: {
        Row: {
          data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          data?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_duplicate_candidates: {
        Args: { p_limit?: number; p_meters?: number }
        Returns: {
          a_completeness: number
          a_id: string
          a_lat: number
          a_lng: number
          a_name: string
          a_osm: boolean
          a_slug: string
          a_status: string
          b_completeness: number
          b_id: string
          b_lat: number
          b_lng: number
          b_name: string
          b_osm: boolean
          b_slug: string
          b_status: string
          distance_m: number
          name_similarity: number
        }[]
      }
      admin_mark_beheer: {
        Args: { p_fields: string[]; p_place_id: string }
        Returns: undefined
      }
      admin_merge_places: {
        Args: { p_keep: string; p_remove: string }
        Returns: Json
      }
      admin_overview: { Args: never; Returns: Json }
      admin_pipeline: { Args: { p_action: string }; Returns: string }
      admin_stats: { Args: { p_days?: number }; Returns: Json }
      apply_discovery: {
        Args: { p_id: string; p_url: string }
        Returns: undefined
      }
      apply_scrape: {
        Args: { p_data: Json; p_error?: string; p_id: string }
        Returns: undefined
      }
      cache_route: {
        Args: {
          p_distance: number
          p_duration: number
          p_geometry: Json
          p_key: string
          p_provider: string
        }
        Returns: undefined
      }
      check_departure: {
        Args: { p_by?: string; p_check: string; p_id: string }
        Returns: undefined
      }
      create_shared_trip: {
        Args: { p_name?: string; p_stops: Json }
        Returns: Json
      }
      create_ticket: {
        Args: {
          p_body: string
          p_category: string
          p_email: string
          p_name: string
          p_place_id?: string
          p_subject: string
        }
        Returns: {
          access_token: string
          number: number
        }[]
      }
      crowd_status: { Args: { p_place_id: string }; Returns: Json }
      enqueue_scrape: { Args: { p_only_missing?: boolean }; Returns: number }
      export_snapshot: { Args: never; Returns: Json }
      get_ticket: { Args: { p_token: string }; Returns: Json }
      ingest_osm: { Args: { p_rows: Json }; Returns: Json }
      ingest_osm_points: { Args: { p_points: Json }; Returns: number }
      is_admin: { Args: never; Returns: boolean }
      is_trip_member: { Args: { p_trip: string }; Returns: boolean }
      join_shared_trip: { Args: { p_code: string }; Returns: Json }
      leave_shared_trip: { Args: { p_trip: string }; Returns: undefined }
      log_consent: {
        Args: {
          p_analytics: boolean
          p_consent_id: string
          p_marketing: boolean
          p_version: string
        }
        Returns: undefined
      }
      nearest_town: {
        Args: { p_lat: number; p_lng: number }
        Returns: {
          id: number
          lat: number
          lng: number
          name: string
          province: string
        }
        SetofOptions: {
          from: "*"
          to: "nl_towns"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      next_discover_batch: {
        Args: { p_limit: number }
        Returns: {
          id: string
          name: string
          phone: string
          postcode: string
          town: string
        }[]
      }
      next_scrape_batch: {
        Args: { p_limit: number }
        Returns: {
          id: string
          name: string
          town: string
          website: string
        }[]
      }
      osm_response: { Args: { p_id: number }; Returns: string }
      place_completeness: {
        Args: { p: Database["public"]["Tables"]["places"]["Row"] }
        Returns: number
      }
      place_meets_must_haves: {
        Args: { p: Database["public"]["Tables"]["places"]["Row"] }
        Returns: boolean
      }
      place_redirect: { Args: { p_slug: string }; Returns: string }
      places_in_bbox: {
        Args: {
          max_lat: number
          max_lng: number
          min_lat: number
          min_lng: number
        }
        Returns: Database["public"]["Tables"]["places"]["Row"][]
        SetofOptions: {
          from: "*"
          to: "places"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      process_osm_staging: { Args: { p_limit?: number }; Returns: Json }
      push_disable_subscriptions: {
        Args: { p_ids: string[] }
        Returns: undefined
      }
      push_public_key: { Args: never; Returns: string }
      push_set_vapid_keys: {
        Args: { p_private: string; p_public: string }
        Returns: undefined
      }
      push_subscribe: {
        Args: { p_auth: string; p_endpoint: string; p_p256dh: string }
        Returns: undefined
      }
      push_take_targets: {
        Args: { p_place_id: string }
        Returns: {
          auth: string
          endpoint: string
          p256dh: string
          place_name: string
          place_slug: string
          subscription_id: string
        }[]
      }
      push_vapid_keys: { Args: never; Returns: Json }
      reply_ticket: {
        Args: { p_body: string; p_token: string }
        Returns: undefined
      }
      report_client_error: {
        Args: { p_context: Json; p_message: string }
        Returns: undefined
      }
      report_crowd: {
        Args: { p_level: string; p_place_id: string }
        Returns: Json
      }
      slugify: { Args: { p: string }; Returns: string }
      submit_place: {
        Args: {
          p_contact_email: string
          p_contact_name: string
          p_kind: string
          p_payload: Json
          p_place_id: string
        }
        Returns: string
      }
      submit_review: {
        Args: {
          p_author_name: string
          p_body: string
          p_place_id: string
          p_rating: number
          p_score_facilities: number
          p_score_location: number
          p_score_quiet: number
          p_score_value: number
          p_title: string
          p_vehicle: string
          p_visited_month: string
        }
        Returns: string
      }
      track: {
        Args: {
          p_name: string
          p_path: string
          p_props: Json
          p_session: string
        }
        Returns: undefined
      }
      user_trust: { Args: { p_user?: string }; Returns: Json }
      watch_place: {
        Args: { p_on?: boolean; p_place_id: string }
        Returns: boolean
      }
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
