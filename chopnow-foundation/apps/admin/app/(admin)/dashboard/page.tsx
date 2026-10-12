import type { Metadata } from "next";
import type { ElementType } from "react";
import Link from "next/link";
import {
  DollarSign, Receipt, Clock, TrendingUp, CircleCheck, XCircle, Store, Bike, AlertTriangle,
} from "lucide-react";
import { Card } from "@chopnow/ui";
import { formatNaira, formatTime } from "@chopnow/lib";
import { getDashboardStats, getRecentOrders, getRecentActivity } from "@/lib/data/dashboard";
import { LiveActivityFeed } from "@/components/ops/live-activity-feed";

export const metadata: Metadata = { title: "Overview" };

const STATUS_LABELS: Record<string, string> = {
  new: "Pending payment",
  payment_confirmed: "Confirmed",
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

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: ElementType;
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "destructive";
}) {
  const toneClasses = {
    default: "bg-accent text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  }[tone];

  return (
    <Card className="p-4">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${toneClasses}`}>
        <Icon size={16} />
      </div>
      <p className="text-2xl font-black tracking-tight text-foreground">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
    </Card>
  );
}

export default async function DashboardPage() {
  const [stats, recentOrders, recentActivity] = await Promise.all([
    getDashboardStats(),
    getRecentOrders(),
    getRecentActivity(),
  ]);

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-extrabold text-foreground">Live Operations</h1>
          <p className="text-[12px] text-muted-foreground">Real-time overview of ChopNow&apos;s operations</p>
        </div>
        {stats.activeAlertsCount > 0 && (
          <Link
            href="/alerts"
            className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1.5 text-[11.5px] font-bold text-destructive"
          >
            <AlertTriangle size={12} /> {stats.activeAlertsCount} active alert{stats.activeAlertsCount !== 1 ? "s" : ""}
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={DollarSign} label="Revenue today" value={formatNaira(stats.revenueToday)} />
        <StatCard icon={Receipt} label="Orders today" value={stats.ordersToday} />
        <StatCard icon={Clock} label="Pending orders" value={stats.pendingOrders} tone={stats.pendingOrders > 5 ? "warning" : "default"} />
        <StatCard icon={TrendingUp} label="Active deliveries" value={stats.activeOrders} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={CircleCheck} label="Completed today" value={stats.completedOrders} tone="success" />
        <StatCard icon={XCircle} label="Cancelled today" value={stats.cancelledOrders} tone={stats.cancelledOrders > 0 ? "destructive" : "default"} />
        <StatCard
          icon={Store}
          label="Restaurants open"
          value={`${stats.restaurantsOpen} / ${stats.restaurantsOpen + stats.restaurantsBusy + stats.restaurantsOffline}`}
        />
        <StatCard icon={Bike} label="Riders online" value={`${stats.ridersOnline} / ${stats.ridersTotal}`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[12.5px] font-extrabold text-foreground">Recent orders</p>
              <Link href="/orders" className="text-[11.5px] font-bold text-primary">
                View all
              </Link>
            </div>
            {recentOrders.length === 0 ? (
              <p className="py-6 text-center text-[12.5px] text-muted-foreground">No orders yet.</p>
            ) : (
              <div className="space-y-2">
                {recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/orders?highlight=${order.id}`}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-muted"
                  >
                    <div>
                      <p className="text-[13px] font-bold text-foreground">
                        {order.orderNumber} <span className="font-normal text-muted-foreground">· {order.restaurantName}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">{formatTime(order.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[12.5px] font-bold text-foreground">{formatNaira(order.total)}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-bold text-muted-foreground">
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <p className="mb-3 text-[12.5px] font-extrabold text-foreground">Dispatch snapshot</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-muted px-2 py-2.5">
                <p className="text-lg font-black text-foreground">{stats.ridersOnline}</p>
                <p className="text-[10.5px] text-muted-foreground">Riders online</p>
              </div>
              <div className="rounded-lg bg-muted px-2 py-2.5">
                <p className="text-lg font-black text-foreground">{stats.ridersBusy}</p>
                <p className="text-[10.5px] text-muted-foreground">Riders busy</p>
              </div>
              <div className="rounded-lg bg-muted px-2 py-2.5">
                <p className="text-lg font-black text-foreground">{stats.ridersOnline - stats.ridersBusy}</p>
                <p className="text-[10.5px] text-muted-foreground">Riders idle</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Link href="/dispatch" className="flex-1 rounded-lg border border-border py-2 text-center text-[12px] font-bold text-foreground transition-colors hover:bg-muted">
                Go to Dispatch
              </Link>
              <Link href="/pipeline" className="flex-1 rounded-lg border border-border py-2 text-center text-[12px] font-bold text-foreground transition-colors hover:bg-muted">
                View Pipeline
              </Link>
            </div>
          </Card>
        </div>

        <div style={{ height: 620 }}>
          <LiveActivityFeed initialEvents={recentActivity} />
        </div>
      </div>
    </div>
  );
}
