/**
 * Pure types and constants shared between the server-only data layer
 * (./restaurants.ts, a "use server" module hitting Supabase) and client
 * components that only need the shapes, not the data fetching itself.
 *
 * This file must stay free of server-only imports (next/headers, the
 * Supabase server client, etc.) — client components import directly from
 * here. Splitting it out from restaurants.ts fixes two real problems:
 *
 *   1. A client component importing *anything* from a module that also
 *      imports next/headers pulls that whole module — next/headers
 *      included — into the client bundle, which Next.js rejects outright.
 *   2. restaurants.ts needs a `"use server"` directive so its functions
 *      are safely callable from client components as Server Actions, and
 *      a "use server" file may only export async functions — it can't
 *      also export a plain const like CATEGORIES or these interfaces.
 */

export const CATEGORIES = [
  { id: "rice", name: "Rice", emoji: "🍚" },
  { id: "swallow", name: "Swallow", emoji: "🍲" },
  { id: "soups", name: "Soups", emoji: "🥣" },
  { id: "pizza", name: "Pizza", emoji: "🍕" },
  { id: "shawarma", name: "Shawarma", emoji: "🌯" },
  { id: "burgers", name: "Burgers", emoji: "🍔" },
  { id: "chicken", name: "Chicken", emoji: "🍗" },
  { id: "drinks", name: "Drinks", emoji: "🥤" },
  { id: "snacks", name: "Snacks", emoji: "🍿" },
  { id: "breakfast", name: "Breakfast", emoji: "🍳" },
] as const;

export interface MockRestaurant {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  coverUrl: string | null;
  logoUrl: string | null;
  phone: string | null;
  address: string | null;
  lat: number;
  lng: number;
  openingHours: Record<string, { open: string; close: string } | null> | null;
  status: "open" | "busy" | "offline";
  isFeatured: boolean;
  baseDeliveryFee: number;
  markupPercentOverride: number | null;
  rating: number;
  reviewCount: number;
  distanceKm: number;
  etaMin: number;
  tags: string[];
  reviews: number;
  popular: string[];
}

export interface MockMenuItem {
  id: string;
  restaurantId: string;
  categoryId: string | null;
  categorySlug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  /** The restaurant's own price — never show this directly to customers. */
  basePrice: number;
  /** The real customer-facing price, computed server-side from the live
   *  global markup setting (or the restaurant's override). Always use
   *  this for display — see packages/lib/supabase/settings.ts for why
   *  this exists as a separate field rather than leaving callers to
   *  recompute applyMarkup() themselves with whatever default they have
   *  on hand. */
  displayPrice: number;
  isAvailable: boolean;
  sortOrder: number;
  badge?: "popular" | "chef" | "soldout";
}

export interface RestaurantSearchParams {
  query?: string;
  category?: string;
  sort?: "nearest" | "fastest" | "rated" | "cheapest";
  filters?: string[];
}
