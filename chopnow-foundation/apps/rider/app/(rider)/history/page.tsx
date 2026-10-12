import type { Metadata } from "next";
import { cookies } from "next/headers";
import { History, MapPin } from "lucide-react";
import { Card, EmptyState } from "@chopnow/ui";
import { createSupabaseServerClient, getAuthenticatedUser, formatNaira, formatDateTime } from "@chopnow/lib";
import type { Database } from "@chopnow/lib/supabase/database.generated";

export const metadata: Metadata = { title: "Delivery history" };

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

const STATUS_LABELS: Record<string, string> = {
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default async function HistoryPage() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const user = await getAuthenticatedUser(supabase);

  const { data: orderRows } = await supabase
    .from("orders")
    .select("*")
    .eq("rider_id", user!.id)
    .in("status", ["delivered", "completed", "cancelled"])
    .order("created_at", { ascending: false })
    .limit(50);

  const orders = (orderRows ?? []) as OrderRow[];

  if (orders.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          icon={History}
          title="No delivery history yet"
          description="Deliveries you've completed will show up here."
        />
      </div>
    );
  }

  const restaurantIds = Array.from(new Set(orders.map((o) => o.restaurant_id)));
  const { data: restaurantRows } = await supabase.from("restaurants").select("id, name").in("id", restaurantIds);
  const nameById = new Map<string, string>((restaurantRows ?? []).map((r) => [r.id, r.name]));

  // Group by calendar day for a scannable list, matching the earnings
  // screen's day-based framing.
  const grouped = new Map<string, OrderRow[]>();
  for (const order of orders) {
    const day = new Date(order.created_at).toDateString();
    if (!grouped.has(day)) grouped.set(day, []);
    grouped.get(day)!.push(order);
  }

  return (
    <div className="space-y-4 p-4">
      {Array.from(grouped.entries()).map(([day, dayOrders]) => (
        <div key={day}>
          <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{day}</p>
          <div className="space-y-2">
            {dayOrders.map((order) => (
              <Card key={order.id} className="p-3.5">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-foreground">
                      {nameById.get(order.restaurant_id) ?? "Restaurant"}
                    </p>
                    <p className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
                      <MapPin size={10} /> {order.delivery_full_address}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {order.order_number} · {formatDateTime(order.created_at)}
                    </p>
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    {order.status !== "cancelled" && order.rider_earnings != null && (
                      <p className="text-[13px] font-bold text-success">+{formatNaira(order.rider_earnings)}</p>
                    )}
                    <span
                      className={
                        order.status === "cancelled"
                          ? "text-[10px] font-bold text-destructive"
                          : "text-[10px] font-bold text-muted-foreground"
                      }
                    >
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
