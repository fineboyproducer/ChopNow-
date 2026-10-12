import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@chopnow/lib";
import type { Database } from "@chopnow/lib/supabase/database.generated";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

const ACTIVE_STATUSES = [
  "new",
  "payment_confirmed",
  "restaurant_notified",
  "restaurant_accepted",
  "preparing",
  "ready_for_pickup",
  "rider_assigned",
  "rider_enroute_restaurant",
  "picked_up",
  "heading_to_customer",
  "delivered",
] as const;

const PENDING_STATUSES = [
  "new",
  "payment_confirmed",
  "restaurant_notified",
  "restaurant_accepted",
  "preparing",
] as const;

export interface DashboardStats {
  revenueToday: number;
  ordersToday: number;
  pendingOrders: number;
  activeOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  restaurantsOpen: number;
  restaurantsBusy: number;
  restaurantsOffline: number;
  totalCustomers: number;
  ridersOnline: number;
  ridersBusy: number;
  ridersTotal: number;
  activeAlertsCount: number;
}

export interface RecentOrderRow {
  id: string;
  orderNumber: string;
  restaurantName: string;
  total: number;
  status: string;
  createdAt: string;
}

async function getClient() {
  const cookieStore = await cookies();
  return createSupabaseServerClient(cookieStore);
}

function startOfTodayIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await getClient();
  const todayStart = startOfTodayIso();

  const [
    { data: todayOrders },
    { count: pendingCount },
    { count: activeCount },
    { count: completedCount },
    { count: cancelledCount },
    { data: restaurants },
    { count: totalCustomers },
    { data: riders },
    { count: activeAlertsCount },
  ] = await Promise.all([
    supabase.from("orders").select("total, payment_status").gte("created_at", todayStart),
    supabase.from("orders").select("id", { count: "exact", head: true }).in("status", PENDING_STATUSES),
    supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ACTIVE_STATUSES),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("created_at", todayStart),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "cancelled")
      .gte("created_at", todayStart),
    supabase.from("restaurants").select("status"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer"),
    supabase.from("riders").select("is_online, status").eq("is_active", true),
    supabase.from("alerts").select("id", { count: "exact", head: true }).is("resolved_at", null),
  ]);

  const revenueToday = (todayOrders ?? [])
    .filter((o) => o.payment_status === "paid" || o.payment_status === "pending")
    .reduce((sum, o) => sum + o.total, 0);

  const restaurantCounts = (restaurants ?? []).reduce(
    (acc, r) => {
      acc[r.status as "open" | "busy" | "offline"] += 1;
      return acc;
    },
    { open: 0, busy: 0, offline: 0 },
  );

  const riderRows = riders ?? [];
  const ridersOnline = riderRows.filter((r) => r.is_online).length;
  const ridersBusy = riderRows.filter((r) => r.is_online && r.status !== "idle").length;

  return {
    revenueToday,
    ordersToday: (todayOrders ?? []).length,
    pendingOrders: pendingCount ?? 0,
    activeOrders: activeCount ?? 0,
    completedOrders: completedCount ?? 0,
    cancelledOrders: cancelledCount ?? 0,
    restaurantsOpen: restaurantCounts.open,
    restaurantsBusy: restaurantCounts.busy,
    restaurantsOffline: restaurantCounts.offline,
    totalCustomers: totalCustomers ?? 0,
    ridersOnline,
    ridersBusy,
    ridersTotal: riderRows.length,
    activeAlertsCount: activeAlertsCount ?? 0,
  };
}

export async function getRecentActivity(limit = 30) {
  const supabase = await getClient();
  const { data } = await supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(limit);
  return data ?? [];
}

export async function getRecentOrders(limit = 10): Promise<RecentOrderRow[]> {
  const supabase = await getClient();

  const { data: orderRows } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  const orders = (orderRows ?? []) as OrderRow[];
  if (orders.length === 0) return [];

  const restaurantIds = Array.from(new Set(orders.map((o) => o.restaurant_id)));
  const { data: restaurantRows } = await supabase.from("restaurants").select("id, name").in("id", restaurantIds);
  const nameById = new Map<string, string>((restaurantRows ?? []).map((r) => [r.id, r.name]));

  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    restaurantName: nameById.get(o.restaurant_id) ?? "Unknown restaurant",
    total: o.total,
    status: o.status,
    createdAt: o.created_at,
  }));
}
