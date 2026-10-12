import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Receipt } from "lucide-react";
import { Card, EmptyState } from "@chopnow/ui";
import { createSupabaseServerClient, getAuthenticatedUser, formatNaira, formatDate } from "@chopnow/lib";
import type { Database } from "@chopnow/lib/supabase/database.generated";

export const metadata: Metadata = { title: "Your orders" };

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

const STATUS_LABELS: Record<string, { label: string; tone: "success" | "muted" | "destructive" }> = {
  new: { label: "Pending payment", tone: "muted" },
  payment_confirmed: { label: "Confirmed", tone: "muted" },
  restaurant_notified: { label: "Sent to restaurant", tone: "muted" },
  restaurant_accepted: { label: "Accepted", tone: "muted" },
  preparing: { label: "Preparing", tone: "muted" },
  ready_for_pickup: { label: "Ready for pickup", tone: "muted" },
  rider_assigned: { label: "Rider assigned", tone: "muted" },
  rider_enroute_restaurant: { label: "Rider en route", tone: "muted" },
  picked_up: { label: "Picked up", tone: "muted" },
  heading_to_customer: { label: "On the way", tone: "muted" },
  delivered: { label: "Delivered", tone: "success" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "destructive" },
  refunded: { label: "Refunded", tone: "destructive" },
};

export default async function OrdersPage() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return (
      <EmptyState
        icon={Receipt}
        title="Sign in to see your orders"
        description="Your order history is tied to your ChopNow account."
      />
    );
  }

  const { data: orderRows } = await supabase
    .from("orders")
    .select("*")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  const orders = (orderRows ?? []) as OrderRow[];

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="No orders yet"
        description="Your order history will show up here once you place your first order."
      />
    );
  }

  // Restaurant names are fetched in a single follow-up query rather than
  // N+1 queries per order row.
  const restaurantIds = Array.from(new Set(orders.map((o) => o.restaurant_id)));
  const { data: restaurantRows } = await supabase
    .from("restaurants")
    .select("id, name")
    .in("id", restaurantIds);
  const restaurantNameById = new Map<string, string>((restaurantRows ?? []).map((r) => [r.id, r.name]));

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const statusInfo = STATUS_LABELS[order.status] ?? { label: order.status, tone: "muted" as const };
        return (
          <Link key={order.id} href={`/orders/${order.order_number}`}>
            <Card className="flex items-center justify-between p-4">
              <div>
                <p className="text-[13px] font-bold text-foreground">
                  {restaurantNameById.get(order.restaurant_id) ?? "Restaurant"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {order.order_number} · {formatDate(order.created_at)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[13px] font-bold text-foreground">{formatNaira(order.total)}</p>
                <span
                  className={
                    statusInfo.tone === "success"
                      ? "rounded-full bg-success/10 px-2 py-0.5 text-[10.5px] font-bold text-success"
                      : statusInfo.tone === "destructive"
                        ? "rounded-full bg-destructive/10 px-2 py-0.5 text-[10.5px] font-bold text-destructive"
                        : "rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-bold text-muted-foreground"
                  }
                >
                  {statusInfo.label}
                </span>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
