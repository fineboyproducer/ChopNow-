"use server";

import { cookies } from "next/headers";
import { createSupabaseServerClient, getGlobalMarkupPercent, applyMarkup } from "@chopnow/lib";
import type { Database } from "@chopnow/lib/supabase/database.generated";
import { CATEGORIES, type MockRestaurant, type MockMenuItem } from "./restaurant-types";
import type { RestaurantSearchParams } from "./restaurant-types";

/**
 * Real data layer, replacing the mock module from Sprint 2. Every
 * function here reads from Supabase directly. Shapes intentionally match
 * what the UI components already expect (camelCase, `distanceKm`/`etaMin`
 * computed fields) so Sprint 2's components needed no changes beyond the
 * import path.
 *
 * "use server" makes every exported function here a Server Action, so
 * discovery-client.tsx (a client component) can call searchRestaurants()
 * directly as an RPC instead of running Supabase/next-headers code in the
 * browser. A "use server" file may only export async functions, which is
 * why CATEGORIES and the Mock* types moved to ./restaurant-types — plain
 * consts and interfaces aren't allowed as exports here.
 */

// Ekpoma town-center reference point, used for distance-from-customer
// display until real customer geolocation/address selection feeds this
// (see lib/actions/addresses.ts) — matches the approach already used for
// "distanceKm" display throughout Sprint 2.
const REFERENCE_LAT = 6.7433;
const REFERENCE_LNG = 6.137;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type RestaurantRow = Database["public"]["Tables"]["restaurants"]["Row"];
type MenuItemRow = Database["public"]["Tables"]["menu_items"]["Row"];
type MenuCategoryRow = Database["public"]["Tables"]["menu_categories"]["Row"];

function mapRestaurant(row: RestaurantRow): MockRestaurant {
  const distanceKm = haversineKm(REFERENCE_LAT, REFERENCE_LNG, Number(row.lat), Number(row.lng));
  // Simple ETA estimate consistent with the formula in packages/lib/eta.ts:
  // prep-time proxy (fixed baseline here since per-restaurant avg prep
  // time isn't tracked yet) + travel time + handoff buffer.
  const etaMin = Math.max(12, Math.round(15 + distanceKm * 4));
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    category: row.category,
    coverUrl: row.cover_url,
    logoUrl: row.logo_url,
    phone: row.phone,
    address: row.address,
    lat: Number(row.lat),
    lng: Number(row.lng),
    openingHours: row.opening_hours as MockRestaurant["openingHours"],
    status: row.status,
    isFeatured: row.is_featured,
    baseDeliveryFee: row.base_delivery_fee,
    markupPercentOverride: row.markup_percent_override,
    rating: Number(row.rating),
    reviewCount: row.review_count,
    distanceKm: Math.round(distanceKm * 10) / 10,
    etaMin,
    tags: [(row.category ?? "").toLowerCase().replace(/\s+/g, "")],
    reviews: row.review_count,
    popular: [],
  };
}

function categorySlugFromName(categories: MenuCategoryRow[], categoryId: string | null): string {
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat) return "other";
  const match = CATEGORIES.find((c) => c.name.toLowerCase() === cat.name.toLowerCase());
  return match?.id ?? cat.name.toLowerCase();
}

function mapMenuItem(
  row: MenuItemRow,
  categories: MenuCategoryRow[],
  globalMarkupPercent: number,
  markupPercentOverride: number | null,
): MockMenuItem {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    categoryId: row.category_id,
    categorySlug: categorySlugFromName(categories, row.category_id),
    name: row.name,
    description: row.description,
    imageUrl: row.image_url,
    basePrice: row.base_price,
    displayPrice: applyMarkup({ basePrice: row.base_price, markupPercentOverride, globalMarkupPercent }),
    isAvailable: row.is_available,
    sortOrder: row.sort_order,
    badge: !row.is_available ? "soldout" : undefined,
  };
}

/**
 * Returns null instead of throwing when Supabase isn't configured (no
 * project provisioned yet, env vars unset), so a config problem shows up
 * as "no restaurants yet" rather than crashing the whole page — these
 * pages (home, discover) are otherwise public and don't need to hard-fail
 * just because the database isn't reachable. A real query error (bad
 * credentials, RLS denial, network blip) is still a different case,
 * handled separately where each query runs.
 */
async function getClient() {
  // cookies() itself must stay outside the try: during a static-generation
  // attempt it throws Next's internal DYNAMIC_SERVER_USAGE bailout signal,
  // which has to propagate so Next correctly falls back to rendering this
  // route dynamically — catching it here would swallow that signal and
  // only incidentally "work" by accident. Only createSupabaseServerClient
  // throws for the case this function actually exists to handle (missing
  // Supabase env vars).
  const cookieStore = await cookies();
  try {
    return createSupabaseServerClient(cookieStore);
  } catch (error) {
    console.error("[restaurants data layer] Supabase client unavailable:", error);
    return null;
  }
}

export async function getRestaurants(): Promise<MockRestaurant[]> {
  const supabase = await getClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("restaurants").select("*").order("name");
  if (error || !data) return [];
  return (data as RestaurantRow[]).map(mapRestaurant).sort((a, b) => a.distanceKm - b.distanceKm);
}

export async function getFeaturedRestaurants(): Promise<MockRestaurant[]> {
  const all = await getRestaurants();
  return all.filter((r) => r.isFeatured);
}

export async function getRestaurantBySlug(
  slug: string,
): Promise<(MockRestaurant & { menu: MockMenuItem[] }) | null> {
  const supabase = await getClient();
  if (!supabase) return null;
  const { data: restaurantRow, error: restaurantError } = await supabase
    .from("restaurants")
    .select("*")
    .eq("slug", slug)
    .single();

  if (restaurantError || !restaurantRow) return null;

  const [{ data: categoryRows }, { data: itemRows }] = await Promise.all([
    supabase.from("menu_categories").select("*").eq("restaurant_id", (restaurantRow as RestaurantRow).id),
    supabase
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", (restaurantRow as RestaurantRow).id)
      .order("sort_order"),
  ]);

  const categories = (categoryRows ?? []) as MenuCategoryRow[];
  const items = (itemRows ?? []) as MenuItemRow[];
  const restaurant = mapRestaurant(restaurantRow as RestaurantRow);
  const globalMarkupPercent = await getGlobalMarkupPercent(supabase);

  return {
    ...restaurant,
    menu: items.map((item) => mapMenuItem(item, categories, globalMarkupPercent, restaurant.markupPercentOverride)),
  };
}

export async function getAllMenuItems(): Promise<
  Array<MockMenuItem & { restaurantSlug: string; restaurantName: string }>
> {
  const restaurants = await getRestaurants();
  const results: Array<MockMenuItem & { restaurantSlug: string; restaurantName: string }> = [];
  for (const restaurant of restaurants) {
    const full = await getRestaurantBySlug(restaurant.slug);
    if (!full) continue;
    for (const item of full.menu) {
      results.push({ ...item, restaurantSlug: restaurant.slug, restaurantName: restaurant.name });
    }
  }
  return results;
}

export async function searchRestaurants(params: RestaurantSearchParams): Promise<MockRestaurant[]> {
  let list = await getRestaurants();

  if (params.query?.trim()) {
    const q = params.query.toLowerCase();
    list = list.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.category ?? "").toLowerCase().includes(q),
    );
  }

  if (params.category) {
    const filtered: MockRestaurant[] = [];
    for (const r of list) {
      const full = await getRestaurantBySlug(r.slug);
      if (full?.menu.some((m) => m.categorySlug === params.category)) filtered.push(r);
    }
    list = filtered;
  }

  (params.filters ?? []).forEach((f) => {
    if (f === "open") list = list.filter((r) => r.status === "open");
  });

  const sorters: Record<string, (a: MockRestaurant, b: MockRestaurant) => number> = {
    nearest: (a, b) => a.distanceKm - b.distanceKm,
    fastest: (a, b) => a.etaMin - b.etaMin,
    rated: (a, b) => b.rating - a.rating,
    cheapest: (a, b) => a.baseDeliveryFee - b.baseDeliveryFee,
  };

  return list.sort(sorters[params.sort ?? "nearest"]);
}
