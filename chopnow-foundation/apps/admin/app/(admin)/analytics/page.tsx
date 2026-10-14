import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Card } from "@chopnow/ui";
import { createSupabaseServerClient, formatNaira } from "@chopnow/lib";
import type { Database } from "@chopnow/lib/supabase/database.generated";

export const metadata: Metadata = { title: "Analytics" };

type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

const REVENUE_COUNTED_STATUSES = new Set(["completed", "delivered"]);

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export default async function AnalyticsPage() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const [{ data: last30DaysOrders }, { data: allOrderItems }, { data: restaurantRows }] = await Promise.all([
    supabase.from("orders").select("*").gte("created_at", daysAgoIso(30)),
    supabase.from("order_items").select("*"),
    supabase.from("restaurants").select("id, name"),
  ]);

  const orders = (last30DaysOrders ?? []) as OrderRow[];
  const revenueOrders = orders.filter((o) => REVENUE_COUNTED_STATUSES.has(o.status));

  const revenueByDay = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const key = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    revenueByDay.set(key, 0);
  }
  for (const order of revenueOrders) {
    const key = order.created_at.slice(0, 10);
    if (revenueByDay.has(key)) revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + order.total);
  }

  const revenue7d = Array.from(revenueByDay.values()).reduce((a, b) => a + b, 0);
  const revenue30d = revenueOrders.reduce((sum, o) => sum + o.total, 0);
  const avgOrderValue = revenueOrders.length > 0 ? Math.round(revenue30d / revenueOrders.length) : 0;

  const orderCountByRestaurant = new Map<string, number>();
  for (const order of orders) {
    orderCountByRestaurant.set(order.restaurant_id, (orderCountByRestaurant.get(order.restaurant_id) ?? 0) + 1);
  }
  const restaurantNameById = new Map<string, string>((restaurantRows ?? []).map((r) => [r.id, r.name]));
  const popularRestaurants = Array.from(orderCountByRestaurant.entries())
    .map(([id, count]) => ({ name: restaurantNameById.get(id) ?? "Unknown", count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const orderIdsInRange = new Set(orders.map((o) => o.id));
  const relevantItems = ((allOrderItems ?? []) as OrderItemRow[]).filter((item) => orderIdsInRange.has(item.order_id));
  const quantityByName = new Map<string, number>();
  for (const item of relevantItems) {
    quantityByName.set(item.name_at_purchase, (quantityByName.get(item.name_at_purchase) ?? 0) + item.quantity);
  }
  const popularMeals = Array.from(quantityByName.entries())
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  const cancelledOrders = orders.filter((o) => o.status === "cancelled");
  const cancelledByReason = new Map<string, number>();
  for (const order of cancelledOrders) {
    const reason = order.cancelled_reason ?? "No reason given";
    cancelledByReason.set(reason, (cancelledByReason.get(reason) ?? 0) + 1);
  }
  const cancellationReasons = Array.from(cancelledByReason.entries()).sort((a, b) => b[1] - a[1]);

  const maxDailyRevenue = Math.max(...revenueByDay.values(), 1);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-extrabold text-foreground">Analytics</h1>
        <p className="text-[12px] text-muted-foreground">Last 30 days, computed from real order data</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4">
          <p className="text-lg font-black text-foreground">{formatNaira(revenue7d)}</p>
          <p className="text-[11px] text-muted-foreground">Revenue (7 days)</p>
        </Card>
        <Card className="p-4">
          <p className="text-lg font-black text-foreground">{formatNaira(revenue30d)}</p>
          <p className="text-[11px] text-muted-foreground">Revenue (30 days)</p>
        </Card>
        <Card className="p-4">
          <p className="text-lg font-black text-foreground">{formatNaira(avgOrderValue)}</p>
          <p className="text-[11px] text-muted-foreground">Average order value</p>
        </Card>
        <Card className="p-4">
          <p className="text-lg font-black text-foreground">{revenueOrders.length}</p>
          <p className="text-[11px] text-muted-foreground">Completed orders (30d)</p>
        </Card>
      </div>

      <Card className="p-4">
        <p className="mb-3 text-[12.5px] font-extrabold text-foreground">Revenue — last 7 days</p>
        <div className="flex h-32 items-end gap-2">
          {Array.from(revenueByDay.entries()).map(([day, value]) => (
            <div key={day} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className="w-full rounded-t bg-primary"
                style={{ height: `${Math.max(4, (value / maxDailyRevenue) * 100)}%` }}
                title={formatNaira(value)}
              />
              <span className="text-[9px] text-muted-foreground">{day.slice(5)}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <p className="mb-3 text-[12.5px] font-extrabold text-foreground">Most popular meals (30d)</p>
          {popularMeals.length === 0 ? (
            <p className="py-4 text-center text-[12px] text-muted-foreground">No order data yet.</p>
          ) : (
            <div className="space-y-2.5">
              {popularMeals.map((meal, i) => (
                <div key={meal.name} className="flex items-center gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-[12.5px] text-foreground">{meal.name}</span>
                  <span className="text-[11px] font-bold text-muted-foreground">{meal.quantity} sold</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <p className="mb-3 text-[12.5px] font-extrabold text-foreground">Most popular restaurants (30d)</p>
          {popularRestaurants.length === 0 ? (
            <p className="py-4 text-center text-[12px] text-muted-foreground">No order data yet.</p>
          ) : (
            <div className="space-y-2.5">
              {popularRestaurants.map((r, i) => (
                <div key={r.name} className="flex items-center gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-[12.5px] text-foreground">{r.name}</span>
                  <span className="text-[11px] font-bold text-muted-foreground">{r.count} orders</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <p className="mb-3 text-[12.5px] font-extrabold text-foreground">Cancellation reasons (30d)</p>
        {cancellationReasons.length === 0 ? (
          <p className="py-4 text-center text-[12px] text-muted-foreground">No cancellations in this period.</p>
        ) : (
          <div className="space-y-2">
            {cancellationReasons.map(([reason, count]) => (
              <div key={reason} className="flex items-center justify-between text-[12.5px]">
                <span className="text-muted-foreground">{reason}</span>
                <span className="font-bold text-foreground">{count}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
