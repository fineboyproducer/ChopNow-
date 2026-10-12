/**
 * This file is a checked-in placeholder for Supabase's generated database
 * types, hand-written to exactly match the SQL in supabase/migrations so
 * the rest of the codebase can compile and typecheck against real table
 * shapes before the project's first real `supabase gen types` run.
 *
 * In a real environment, run:
 *
 *   npm run supabase:types
 *
 * which runs `supabase gen types typescript --local` and overwrites this
 * file with the actual generated `Database` type. Do not hand-edit the
 * generated output once that's happened — edit the migrations instead
 * and regenerate. Until then, if you add/change a migration, update this
 * file to match in the same commit so types don't silently drift from
 * the real schema.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type UserRole = "customer" | "admin" | "dispatcher" | "restaurant" | "rider";
type RestaurantStatus = "open" | "busy" | "offline";
type OrderStatusEnum =
  | "new"
  | "payment_confirmed"
  | "restaurant_notified"
  | "restaurant_accepted"
  | "preparing"
  | "ready_for_pickup"
  | "rider_assigned"
  | "rider_enroute_restaurant"
  | "picked_up"
  | "heading_to_customer"
  | "delivered"
  | "completed"
  | "cancelled"
  | "refunded";
type PaymentMethodEnum = "paystack" | "flutterwave" | "cash";
type PaymentStatusEnum = "pending" | "paid" | "failed" | "refunded";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          full_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          role?: UserRole;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };

      addresses: {
        Row: {
          id: string;
          user_id: string;
          label: string | null;
          full_address: string;
          lat: number;
          lng: number;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label?: string | null;
          full_address: string;
          lat: number;
          lng: number;
          is_default?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["addresses"]["Insert"]>;
        Relationships: [];
      };

      restaurants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          category: string | null;
          cover_url: string | null;
          logo_url: string | null;
          phone: string | null;
          address: string | null;
          lat: number;
          lng: number;
          opening_hours: Json | null;
          status: RestaurantStatus;
          is_featured: boolean;
          base_delivery_fee: number;
          markup_percent_override: number | null;
          rating: number;
          review_count: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          category?: string | null;
          cover_url?: string | null;
          logo_url?: string | null;
          phone?: string | null;
          address?: string | null;
          lat: number;
          lng: number;
          opening_hours?: Json | null;
          status?: RestaurantStatus;
          is_featured?: boolean;
          base_delivery_fee?: number;
          markup_percent_override?: number | null;
          rating?: number;
          review_count?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["restaurants"]["Insert"]>;
        Relationships: [];
      };

      menu_categories: {
        Row: {
          id: string;
          restaurant_id: string;
          name: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          name: string;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["menu_categories"]["Insert"]>;
        Relationships: [];
      };

      menu_items: {
        Row: {
          id: string;
          restaurant_id: string;
          category_id: string | null;
          name: string;
          description: string | null;
          image_url: string | null;
          base_price: number;
          is_available: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          category_id?: string | null;
          name: string;
          description?: string | null;
          image_url?: string | null;
          base_price: number;
          is_available?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["menu_items"]["Insert"]>;
        Relationships: [];
      };

      orders: {
        Row: {
          id: string;
          order_number: string;
          customer_id: string;
          restaurant_id: string;
          rider_id: string | null;
          status: OrderStatusEnum;
          delivery_address_id: string | null;
          delivery_lat: number | null;
          delivery_lng: number | null;
          delivery_full_address: string;
          delivery_phone: string;
          subtotal: number;
          delivery_fee: number;
          service_fee: number;
          total: number;
          payment_method: PaymentMethodEnum;
          payment_reference: string | null;
          payment_status: PaymentStatusEnum;
          estimated_delivery_minutes: number | null;
          placed_at: string;
          delivered_at: string | null;
          rider_earnings: number | null;
          cancelled_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_number?: string;
          customer_id: string;
          restaurant_id: string;
          rider_id?: string | null;
          status?: OrderStatusEnum;
          delivery_address_id?: string | null;
          delivery_lat?: number | null;
          delivery_lng?: number | null;
          delivery_full_address: string;
          delivery_phone: string;
          subtotal: number;
          delivery_fee: number;
          service_fee: number;
          total: number;
          payment_method: PaymentMethodEnum;
          payment_reference?: string | null;
          payment_status?: PaymentStatusEnum;
          estimated_delivery_minutes?: number | null;
          placed_at?: string;
          delivered_at?: string | null;
          rider_earnings?: number | null;
          cancelled_reason?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
        Relationships: [];
      };

      order_items: {
        Row: {
          id: string;
          order_id: string;
          menu_item_id: string | null;
          name_at_purchase: string;
          base_price_at_purchase: number;
          markup_applied: number;
          price_at_purchase: number;
          quantity: number;
          special_instructions: string | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          menu_item_id?: string | null;
          name_at_purchase: string;
          base_price_at_purchase: number;
          markup_applied?: number;
          price_at_purchase: number;
          quantity: number;
          special_instructions?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Insert"]>;
        Relationships: [];
      };

      order_status_history: {
        Row: {
          id: number;
          order_id: string;
          status: OrderStatusEnum;
          changed_by: string | null;
          changed_at: string;
          exited_at: string | null;
          handler_type: "restaurant" | "rider" | "system" | "admin" | null;
          handler_id: string | null;
        };
        Insert: {
          id?: number;
          order_id: string;
          status: OrderStatusEnum;
          changed_by?: string | null;
          changed_at?: string;
          exited_at?: string | null;
          handler_type?: "restaurant" | "rider" | "system" | "admin" | null;
          handler_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["order_status_history"]["Insert"]>;
        Relationships: [];
      };

      riders: {
        Row: {
          id: string;
          vehicle_type: string;
          is_online: boolean;
          status: "idle" | "assigned" | "enroute_restaurant" | "picked_up" | "delivering";
          current_lat: number | null;
          current_lng: number | null;
          rating: number;
          acceptance_rate: number;
          avg_delivery_minutes: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          vehicle_type?: string;
          is_online?: boolean;
          status?: "idle" | "assigned" | "enroute_restaurant" | "picked_up" | "delivering";
          current_lat?: number | null;
          current_lng?: number | null;
          rating?: number;
          acceptance_rate?: number;
          avg_delivery_minutes?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["riders"]["Insert"]>;
        Relationships: [];
      };

      stage_sla_config: {
        Row: {
          stage: OrderStatusEnum;
          sla_seconds: number;
        };
        Insert: {
          stage: OrderStatusEnum;
          sla_seconds: number;
        };
        Update: Partial<Database["public"]["Tables"]["stage_sla_config"]["Insert"]>;
        Relationships: [];
      };

      dispatch_attempts: {
        Row: {
          id: string;
          order_id: string;
          rider_id: string | null;
          score: number | null;
          score_breakdown: Json | null;
          offered_at: string;
          responded_at: string | null;
          outcome: "accepted" | "rejected" | "timed_out" | "cancelled" | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          rider_id?: string | null;
          score?: number | null;
          score_breakdown?: Json | null;
          offered_at?: string;
          responded_at?: string | null;
          outcome?: "accepted" | "rejected" | "timed_out" | "cancelled" | null;
        };
        Update: Partial<Database["public"]["Tables"]["dispatch_attempts"]["Insert"]>;
        Relationships: [];
      };

      rider_locations: {
        Row: {
          id: number;
          rider_id: string;
          lat: number;
          lng: number;
          recorded_at: string;
        };
        Insert: {
          id?: number;
          rider_id: string;
          lat: number;
          lng: number;
          recorded_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["rider_locations"]["Insert"]>;
        Relationships: [];
      };

      alerts: {
        Row: {
          id: string;
          type:
            | "restaurant_delay"
            | "no_rider_accepted"
            | "customer_wait_exceeded"
            | "restaurant_offline"
            | "rider_offline_midway"
            | "payment_failed"
            | "order_cancelled"
            | "high_demand";
          severity: "red" | "amber" | "blue";
          message: string;
          order_id: string | null;
          restaurant_id: string | null;
          rider_id: string | null;
          created_at: string;
          resolved_at: string | null;
          resolved_by: string | null;
        };
        Insert: {
          id?: string;
          type:
            | "restaurant_delay"
            | "no_rider_accepted"
            | "customer_wait_exceeded"
            | "restaurant_offline"
            | "rider_offline_midway"
            | "payment_failed"
            | "order_cancelled"
            | "high_demand";
          severity: "red" | "amber" | "blue";
          message: string;
          order_id?: string | null;
          restaurant_id?: string | null;
          rider_id?: string | null;
          created_at?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["alerts"]["Insert"]>;
        Relationships: [];
      };

      activity_log: {
        Row: {
          id: number;
          category: "order" | "rider" | "restaurant" | "payment" | "system";
          severity: "green" | "blue" | "amber" | "red";
          message: string;
          order_id: string | null;
          rider_id: string | null;
          restaurant_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          category: "order" | "rider" | "restaurant" | "payment" | "system";
          severity?: "green" | "blue" | "amber" | "red";
          message: string;
          order_id?: string | null;
          rider_id?: string | null;
          restaurant_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["activity_log"]["Insert"]>;
        Relationships: [];
      };

      platform_settings: {
        Row: {
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["platform_settings"]["Insert"]>;
        Relationships: [];
      };

      rider_payout_config: {
        Row: {
          key: string;
          value: number;
        };
        Insert: {
          key: string;
          value: number;
        };
        Update: Partial<Database["public"]["Tables"]["rider_payout_config"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      restaurant_status: RestaurantStatus;
      order_status: OrderStatusEnum;
      payment_method: PaymentMethodEnum;
      payment_status: PaymentStatusEnum;
      alert_type:
        | "restaurant_delay"
        | "no_rider_accepted"
        | "customer_wait_exceeded"
        | "restaurant_offline"
        | "rider_offline_midway"
        | "payment_failed"
        | "order_cancelled"
        | "high_demand";
    };
    CompositeTypes: Record<string, never>;
  };
}
