import { cookies } from "next/headers";
import { createSupabaseServerClient, getAuthenticatedUser } from "@chopnow/lib";
import type { Database } from "@chopnow/lib/supabase/database.generated";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type DispatchAttemptRow = Database["public"]["Tables"]["dispatch_attempts"]["Row"];
type RestaurantRow = Database["public"]["Tables"]["restaurants"]["Row"];

export interface PendingOffer {
  attempt: DispatchAttemptRow;
  order: OrderRow;
  restaurant: RestaurantRow | null;
  itemCount: number;
}

export interface ActiveDeliveryData {
  order: OrderRow;
  restaurant: RestaurantRow | null;
  itemCount: number;
}

async function getClientAndRiderId() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const user = await getAuthenticatedUser(supabase);
  return { supabase, riderId: user!.id };
}

export async function getActiveDelivery(): Promise<ActiveDeliveryData | null> {
  const { supabase, riderId } = await getClientAndRiderId();

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("rider_id", riderId)
    .in("status", ["rider_assigned", "rider_enroute_restaurant", "picked_up", "heading_to_customer"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!order) return null;

  const [{ data: restaurant }, { count: itemCount }] = await Promise.all([
    supabase.from("restaurants").select("*").eq("id", (order as OrderRow).restaurant_id).single(),
    supabase.from("order_items").select("id", { count: "exact", head: true }).eq("order_id", (order as OrderRow).id),
  ]);

  return { order: order as OrderRow, restaurant: (restaurant as RestaurantRow) ?? null, itemCount: itemCount ?? 0 };
}

export async function getPendingOffers(): Promise<PendingOffer[]> {
  const { supabase, riderId } = await getClientAndRiderId();

  const { data: attempts } = await supabase
    .from("dispatch_attempts")
    .select("*")
    .eq("rider_id", riderId)
    .is("outcome", null)
    .order("offered_at", { ascending: false });

  const pending = (attempts ?? []) as DispatchAttemptRow[];
  if (pending.length === 0) return [];

  const orderIds = pending.map((a) => a.order_id);
  const { data: orders } = await supabase.from("orders").select("*").in("id", orderIds);
  const orderById = new Map<string, OrderRow>(((orders ?? []) as OrderRow[]).map((o) => [o.id, o]));

  const restaurantIds = Array.from(new Set(Array.from(orderById.values()).map((o) => o.restaurant_id)));
  const { data: restaurants } = restaurantIds.length
    ? await supabase.from("restaurants").select("*").in("id", restaurantIds)
    : { data: [] };
  const restaurantById = new Map<string, RestaurantRow>(((restaurants ?? []) as RestaurantRow[]).map((r) => [r.id, r]));

  const { data: itemCounts } = await supabase.from("order_items").select("order_id").in("order_id", orderIds);
  const countByOrder = new Map<string, number>();
  for (const row of itemCounts ?? []) {
    countByOrder.set(row.order_id, (countByOrder.get(row.order_id) ?? 0) + 1);
  }

  return pending
    .map((attempt) => {
      const order = orderById.get(attempt.order_id);
      if (!order) return null;
      return {
        attempt,
        order,
        restaurant: restaurantById.get(order.restaurant_id) ?? null,
        itemCount: countByOrder.get(order.id) ?? 0,
      };
    })
    .filter((x): x is PendingOffer => x !== null);
}
