"use client";

import * as React from "react";
import { Phone, MessageCircle, Power, Package, Bike } from "lucide-react";
import { Card, Button, EmptyState } from "@chopnow/ui";
import { cn } from "@chopnow/lib";
import type { Database } from "@chopnow/lib/supabase/database.generated";
import { setRiderActiveAction } from "@/lib/actions/riders";

type RiderRow = Database["public"]["Tables"]["riders"]["Row"];

interface RiderCardData {
  rider: RiderRow;
  name: string;
  phone: string | null;
  currentOrder: { id: string; order_number: string } | null;
}

const STATUS_LABELS: Record<RiderRow["status"], string> = {
  idle: "Idle",
  assigned: "Assigned",
  enroute_restaurant: "En route to restaurant",
  picked_up: "Picked up",
  delivering: "Delivering",
};

function RiderCard({ data }: { data: RiderCardData }) {
  const [isActive, setIsActive] = React.useState(data.rider.is_active);
  const [pending, setPending] = React.useState(false);

  const handleToggleActive = async () => {
    const next = !isActive;
    if (!next && !confirm(`Deactivate ${data.name}? They won't receive any new delivery offers.`)) return;
    setIsActive(next);
    setPending(true);
    const result = await setRiderActiveAction(data.rider.id, next);
    setPending(false);
    if (!result.success) setIsActive(!next);
  };

  const statusTone = !data.rider.is_online
    ? "bg-muted text-muted-foreground"
    : data.rider.status === "idle"
      ? "bg-success/10 text-success"
      : "bg-warning/10 text-warning";

  return (
    <Card className={cn("p-4", !isActive && "opacity-60")}>
      <div className="mb-3 flex items-start gap-3">
        <div className="relative shrink-0">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-[15px] font-bold text-primary">
            {data.name.charAt(0).toUpperCase()}
          </div>
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card",
              data.rider.is_online ? "bg-success" : "bg-muted-foreground",
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-bold text-foreground">{data.name}</p>
          <p className="text-[11px] text-muted-foreground">{data.rider.vehicle_type}</p>
          <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold", statusTone)}>
            {data.rider.is_online ? STATUS_LABELS[data.rider.status] : "Offline"}
          </span>
        </div>
      </div>

      {data.currentOrder && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-accent px-3 py-2">
          <span className="flex items-center gap-1.5 text-[11.5px] font-bold text-primary">
            <Package size={12} /> {data.currentOrder.order_number}
          </span>
        </div>
      )}

      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-[11px]">
        <div className="rounded-lg bg-muted px-2 py-1.5">
          <p className="font-bold text-foreground">⭐ {data.rider.rating}</p>
          <p className="text-muted-foreground">Rating</p>
        </div>
        <div className="rounded-lg bg-muted px-2 py-1.5">
          <p className="font-bold text-foreground">{data.rider.acceptance_rate}%</p>
          <p className="text-muted-foreground">Accept rate</p>
        </div>
        <div className="rounded-lg bg-muted px-2 py-1.5">
          <p className="font-bold text-foreground">{data.rider.avg_delivery_minutes}m</p>
          <p className="text-muted-foreground">Avg time</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {data.phone && (
          <a href={`tel:${data.phone}`}>
            <Button size="sm" variant="ghost">
              <Phone size={11} /> Call
            </Button>
          </a>
        )}
        <Button size="sm" variant="ghost" disabled>
          <MessageCircle size={11} /> Message
        </Button>
        <Button size="sm" variant={isActive ? "outline" : "ghost"} onClick={handleToggleActive} disabled={pending}>
          <Power size={11} /> {isActive ? "Deactivate" : "Reactivate"}
        </Button>
      </div>
    </Card>
  );
}

export function RidersClient({ riders }: { riders: RiderCardData[] }) {
  const [filter, setFilter] = React.useState<"all" | "online" | "offline">("all");

  const filtered = riders.filter((r) => {
    if (filter === "online") return r.rider.is_online;
    if (filter === "offline") return !r.rider.is_online;
    return true;
  });

  if (riders.length === 0) {
    return (
      <EmptyState
        icon={Bike}
        title="No riders yet"
        description="Riders will appear here once accounts are created for them (see PRD FR-AUTH-02 — riders don't self-signup)."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["all", "online", "offline"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[11.5px] font-bold capitalize transition-colors",
              filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((data) => (
          <RiderCard key={data.rider.id} data={data} />
        ))}
      </div>
    </div>
  );
}
