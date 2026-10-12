import { cookies } from "next/headers";
import { createSupabaseServerClient, getAuthenticatedUser } from "@chopnow/lib";
import type { Database } from "@chopnow/lib/supabase/database.generated";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

export interface EarningsSummary {
  todayTotal: number;
  todayDeliveries: number;
  weekTotal: number;
  weekDeliveries: number;
  allTimeTotal: number;
  allTimeDeliveries: number;
}

function startOfTodayIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

function startOfWeekIso(): string {
  const now = new Date();
  const day = now.getDay();
  // Week starts Monday, matching how ChopNow operations reports weekly
  // numbers elsewhere (PRD Section 12.2's weekly reporting cadence).
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.getFullYear(), now.getMonth(), diff);
  return monday.toISOString();
}

/**
 * Real earnings, derived entirely from orders.rider_earnings — a
 * column populated automatically by the set_rider_earnings trigger
 * (0009_rider_earnings.sql) the moment an order reaches `delivered`.
 * Nothing here is estimated or fabricated client-side.
 */
export async function getEarningsSummary(): Promise<EarningsSummary> {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const user = await getAuthenticatedUser(supabase);
  const riderId = user!.id;

  const { data: allDelivered } = await supabase
    .from("orders")
    .select("rider_earnings, delivered_at")
    .eq("rider_id", riderId)
    .not("delivered_at", "is", null);

  const rows = (allDelivered ?? []) as Pick<OrderRow, "rider_earnings" | "delivered_at">[];

  const todayStart = startOfTodayIso();
  const weekStart = startOfWeekIso();

  let todayTotal = 0;
  let todayDeliveries = 0;
  let weekTotal = 0;
  let weekDeliveries = 0;
  let allTimeTotal = 0;

  for (const row of rows) {
    const earnings = row.rider_earnings ?? 0;
    allTimeTotal += earnings;
    if (row.delivered_at && row.delivered_at >= todayStart) {
      todayTotal += earnings;
      todayDeliveries += 1;
    }
    if (row.delivered_at && row.delivered_at >= weekStart) {
      weekTotal += earnings;
      weekDeliveries += 1;
    }
  }

  return {
    todayTotal,
    todayDeliveries,
    weekTotal,
    weekDeliveries,
    allTimeTotal,
    allTimeDeliveries: rows.length,
  };
}

export interface EarningsHistoryRow {
  orderId: string;
  orderNumber: string;
  restaurantName: string;
  earnings: number;
  deliveredAt: string;
}

export async function getEarningsHistory(limit = 30): Promise<EarningsHistoryRow[]> {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const user = await getAuthenticatedUser(supabase);
  const riderId = user!.id;

  const { data: orderRows } = await supabase
    .from("orders")
    .select("*")
    .eq("rider_id", riderId)
    .not("delivered_at", "is", null)
    .order("delivered_at", { ascending: false })
    .limit(limit);

  const orders = (orderRows ?? []) as OrderRow[];
  if (orders.length === 0) return [];

  const restaurantIds = Array.from(new Set(orders.map((o) => o.restaurant_id)));
  const { data: restaurantRows } = await supabase.from("restaurants").select("id, name").in("id", restaurantIds);
  const nameById = new Map<string, string>((restaurantRows ?? []).map((r) => [r.id, r.name]));

  return orders.map((o) => ({
    orderId: o.id,
    orderNumber: o.order_number,
    restaurantName: nameById.get(o.restaurant_id) ?? "Unknown restaurant",
    earnings: o.rider_earnings ?? 0,
    deliveredAt: o.delivered_at!,
  }));
}
