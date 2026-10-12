"use client";

import * as React from "react";
import {
  ChevronDown, AlertTriangle, Package, CreditCard, Send, CircleCheck, ChefHat,
  PackageCheck, Bike, Navigation, Truck, MapPinned, Check,
} from "lucide-react";
import { Card, Button, EmptyState } from "@chopnow/ui";
import { cn, formatNaira, formatTime } from "@chopnow/lib";
import type { Database } from "@chopnow/lib/supabase/database.generated";
import { advanceOrderStatusAction, cancelOrderAction } from "@/lib/actions/orders";

type OrderRowData = Database["public"]["Tables"]["orders"]["Row"];

const STAGES = [
  { key: "new", label: "New Order", icon: Package },
  { key: "payment_confirmed", label: "Payment Confirmed", icon: CreditCard },
  { key: "restaurant_notified", label: "Restaurant Notified", icon: Send },
  { key: "restaurant_accepted", label: "Restaurant Accepted", icon: CircleCheck },
  { key: "preparing", label: "Preparing Food", icon: ChefHat },
  { key: "ready_for_pickup", label: "Ready For Pickup", icon: PackageCheck },
  { key: "rider_assigned", label: "Rider Assigned", icon: Bike },
  { key: "rider_enroute_restaurant", label: "Rider En Route To Restaurant", icon: Navigation },
  { key: "picked_up", label: "Food Picked Up", icon: Package },
  { key: "heading_to_customer", label: "Heading To Customer", icon: Truck },
  { key: "delivered", label: "Delivered", icon: MapPinned },
  { key: "completed", label: "Completed", icon: Check },
] as const;

function stageIndex(status: string): number {
  const i = STAGES.findIndex((s) => s.key === status);
  return i === -1 ? 0 : i;
}

function useTicker(intervalMs = 1000) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
}

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}m ${s}s`;
}

interface OrderPipelineData {
  order: OrderRowData;
  restaurantName: string;
  riderName: string | null;
  stageEnteredAt: string;
}

function PipelineOrderRow({
  data,
  expanded,
  onToggle,
  slaByStage,
}: {
  data: OrderPipelineData;
  expanded: boolean;
  onToggle: () => void;
  slaByStage: Record<string, number>;
}) {
  useTicker(1000);
  const [cancelling, setCancelling] = React.useState(false);
  const [advancing, setAdvancing] = React.useState(false);

  const idx = stageIndex(data.order.status);
  // stageIndex() already falls back to 0 for an unrecognized status, so
  // this is always in range at runtime — the `?? STAGES[0]` just gives
  // TypeScript (under noUncheckedIndexedAccess) the same guarantee
  // explicitly, rather than asserting past it.
  const stage = STAGES[idx] ?? STAGES[0];
  const sla = slaByStage[data.order.status] ?? 0;
  const secInStage = (Date.now() - new Date(data.stageEnteredAt).getTime()) / 1000;
  const isDelayed = sla > 0 && secInStage > sla;
  const handler = idx <= 5 ? data.restaurantName : (data.riderName ?? "Unassigned");
  const canAdvance = data.order.status !== "completed" && data.order.status !== "cancelled";

  const handleAdvance = async () => {
    setAdvancing(true);
    await advanceOrderStatusAction(data.order.id);
    setAdvancing(false);
  };

  const handleCancel = async () => {
    const reason = prompt("Reason for cancelling?", "Cancelled by dispatcher");
    if (reason === null) return;
    setCancelling(true);
    await cancelOrderAction(data.order.id, reason);
    setCancelling(false);
  };

  return (
    <Card className={cn("overflow-hidden", isDelayed && "border-destructive/40")}>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", isDelayed ? "bg-destructive/10" : "bg-accent")}>
          <stage.icon size={15} className={isDelayed ? "text-destructive" : "text-primary"} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-foreground">{data.order.order_number}</span>
            <span className="text-[11.5px] text-muted-foreground">{data.restaurantName}</span>
            {isDelayed && (
              <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[9.5px] font-bold text-destructive">
                <AlertTriangle size={9} /> Delayed
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {stage.label} · handled by {handler}
          </p>
        </div>
        <div className="hidden text-right sm:block">
          <p className={cn("text-[12px] font-bold", isDelayed ? "text-destructive" : "text-muted-foreground")}>
            {formatDuration(secInStage)}
          </p>
          <p className="text-[10px] text-muted-foreground">in this stage</p>
        </div>
        <span className="shrink-0 text-[12.5px] font-bold text-foreground">{formatNaira(data.order.total)}</span>
        <ChevronDown size={15} className={cn("shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          <div className="mb-3 flex items-center gap-0.5 overflow-x-auto pb-1">
            {STAGES.map((s, i) => (
              <div key={s.key} className="flex shrink-0 items-center">
                <div
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-md",
                    i < idx ? "bg-success/10" : i === idx ? (isDelayed ? "bg-destructive/10" : "bg-accent") : "bg-muted",
                  )}
                  title={s.label}
                >
                  <s.icon
                    size={11}
                    className={i < idx ? "text-success" : i === idx ? (isDelayed ? "text-destructive" : "text-primary") : "text-muted-foreground"}
                  />
                </div>
                {i < STAGES.length - 1 && <div className={cn("h-px w-3", i < idx ? "bg-success" : "bg-border")} />}
              </div>
            ))}
          </div>

          <div className="mb-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-muted px-3 py-2">
              <p className="text-[10px] text-muted-foreground">Time entered stage</p>
              <p className="mt-0.5 text-[12px] font-bold text-foreground">{formatTime(data.stageEnteredAt)}</p>
            </div>
            <div className="rounded-lg bg-muted px-3 py-2">
              <p className="text-[10px] text-muted-foreground">Time spent in stage</p>
              <p className={cn("mt-0.5 text-[12px] font-bold", isDelayed ? "text-destructive" : "text-foreground")}>
                {formatDuration(secInStage)} {sla > 0 && <span className="text-muted-foreground">/ SLA {Math.floor(sla / 60)}m</span>}
              </p>
            </div>
            <div className="rounded-lg bg-muted px-3 py-2">
              <p className="text-[10px] text-muted-foreground">Current handler</p>
              <p className="mt-0.5 text-[12px] font-bold text-foreground">{handler}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {canAdvance && (
              <Button size="sm" variant="ghost" onClick={handleAdvance} disabled={advancing}>
                {advancing ? "..." : "Advance stage"}
              </Button>
            )}
            {canAdvance && (
              <Button size="sm" variant="destructive" onClick={handleCancel} disabled={cancelling}>
                {cancelling ? "..." : "Cancel order"}
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

export function PipelineClient({
  orders,
  slaByStage,
}: {
  orders: OrderPipelineData[];
  slaByStage: Record<string, number>;
}) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"all" | "kitchen" | "dispatch" | "delayed">("all");
  useTicker(1000);

  const grouped = {
    kitchen: orders.filter((o) => stageIndex(o.order.status) >= 1 && stageIndex(o.order.status) <= 5),
    dispatch: orders.filter((o) => stageIndex(o.order.status) >= 6 && stageIndex(o.order.status) <= 9),
  };

  const isDelayedOrder = (o: OrderPipelineData) => {
    const sla = slaByStage[o.order.status] ?? 0;
    if (sla <= 0) return false;
    return (Date.now() - new Date(o.stageEnteredAt).getTime()) / 1000 > sla;
  };
  const delayedCount = orders.filter(isDelayedOrder).length;

  const visible =
    filter === "all" ? orders : filter === "delayed" ? orders.filter(isDelayedOrder) : grouped[filter] ?? orders;

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No orders in flight"
        description="Active orders will appear here as they move through the pipeline."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          { id: "all" as const, label: `All (${orders.length})` },
          { id: "kitchen" as const, label: `In Kitchen (${grouped.kitchen.length})` },
          { id: "dispatch" as const, label: `In Dispatch (${grouped.dispatch.length})` },
          { id: "delayed" as const, label: `Delayed (${delayedCount})` },
        ].map((f) => (
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

      <div className="space-y-2">
        {visible.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-muted-foreground">No orders match this filter.</p>
        ) : (
          visible.map((data) => (
            <PipelineOrderRow
              key={data.order.id}
              data={data}
              expanded={expandedId === data.order.id}
              onToggle={() => setExpandedId(expandedId === data.order.id ? null : data.order.id)}
              slaByStage={slaByStage}
            />
          ))
        )}
      </div>
    </div>
  );
}
