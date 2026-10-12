"use client";

import * as React from "react";
import { ArrowRight, Ban } from "lucide-react";
import { Card, Button } from "@chopnow/ui";
import { cn, formatNaira, formatDateTime } from "@chopnow/lib";
import type { Database } from "@chopnow/lib/supabase/database.generated";
import { advanceOrderStatusAction, cancelOrderAction } from "@/lib/actions/orders";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

const STATUS_LABELS: Record<string, string> = {
  new: "Pending payment",
  payment_confirmed: "Payment confirmed",
  restaurant_notified: "Sent to restaurant",
  restaurant_accepted: "Accepted",
  preparing: "Preparing",
  ready_for_pickup: "Ready for pickup",
  rider_assigned: "Rider assigned",
  rider_enroute_restaurant: "Rider en route",
  picked_up: "Picked up",
  heading_to_customer: "On the way",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
] as const;

const ACTIVE_STATUSES = new Set([
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
]);

function OrderRowCard({ order, restaurantName }: { order: OrderRow; restaurantName: string }) {
  const [status, setStatus] = React.useState(order.status);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canAdvance = status !== "completed" && status !== "cancelled" && status !== "refunded";
  const canCancel = status !== "completed" && status !== "cancelled" && status !== "refunded";

  const handleAdvance = async () => {
    setBusy(true);
    setError(null);
    const result = await advanceOrderStatusAction(order.id);
    setBusy(false);
    if (result.success) setStatus(result.data.newStatus);
    else setError(result.error.message);
  };

  const handleCancel = async () => {
    const reason = prompt("Reason for cancelling this order?", "Cancelled by admin");
    if (reason === null) return;
    setBusy(true);
    setError(null);
    const result = await cancelOrderAction(order.id, reason);
    setBusy(false);
    if (result.success) setStatus("cancelled");
    else setError(result.error.message);
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-bold text-foreground">
            {order.order_number} <span className="font-normal text-muted-foreground">· {restaurantName}</span>
          </p>
          <p className="text-[11px] text-muted-foreground">{formatDateTime(order.created_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-foreground">{formatNaira(order.total)}</span>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[10.5px] font-bold",
              status === "completed" || status === "delivered"
                ? "bg-success/10 text-success"
                : status === "cancelled" || status === "refunded"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {STATUS_LABELS[status] ?? status}
          </span>
        </div>
      </div>

      {error && <p className="mt-2 text-[11.5px] font-medium text-destructive">{error}</p>}

      {(canAdvance || canCancel) && (
        <div className="mt-3 flex gap-2">
          {canAdvance && (
            <Button size="sm" variant="ghost" onClick={handleAdvance} disabled={busy}>
              <ArrowRight size={12} /> Advance stage
            </Button>
          )}
          {canCancel && (
            <Button size="sm" variant="destructive" onClick={handleCancel} disabled={busy}>
              <Ban size={12} /> Cancel order
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

export function OrdersListClient({
  orders,
  restaurantNameById,
}: {
  orders: OrderRow[];
  restaurantNameById: Record<string, string>;
}) {
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]["id"]>("all");

  const filtered = orders.filter((o) => {
    if (filter === "all") return true;
    if (filter === "active") return ACTIVE_STATUSES.has(o.status);
    if (filter === "completed") return o.status === "completed";
    if (filter === "cancelled") return o.status === "cancelled" || o.status === "refunded";
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[11.5px] font-bold transition-colors",
              filter === f.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-muted-foreground">No orders match this filter.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((order) => (
            <OrderRowCard
              key={order.id}
              order={order}
              restaurantName={restaurantNameById[order.restaurant_id] ?? "Unknown restaurant"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
