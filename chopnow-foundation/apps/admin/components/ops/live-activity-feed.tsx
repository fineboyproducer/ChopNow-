"use client";

import * as React from "react";
import type { ElementType } from "react";
import { Activity, Package, Bike, Store, CreditCard, Info } from "lucide-react";
import { Card } from "@chopnow/ui";
import { createSupabaseBrowserClient, timeAgo, cn } from "@chopnow/lib";
import type { Database } from "@chopnow/lib/supabase/database.generated";

type ActivityLogRow = Database["public"]["Tables"]["activity_log"]["Row"];

const CATEGORY_ICON: Record<ActivityLogRow["category"], ElementType> = {
  order: Package,
  rider: Bike,
  restaurant: Store,
  payment: CreditCard,
  system: Info,
};

const SEVERITY_CLASSES: Record<ActivityLogRow["severity"], { bg: string; fg: string }> = {
  green: { bg: "bg-success/10", fg: "text-success" },
  blue: { bg: "bg-info/10", fg: "text-info" },
  amber: { bg: "bg-warning/10", fg: "text-warning" },
  red: { bg: "bg-destructive/10", fg: "text-destructive" },
};

/**
 * Subscribes to INSERTs on `activity_log` in real time — per the
 * architecture doc, this table is the single source for the feed so the
 * UI never has to derive feed entries client-side from multiple tables
 * (orders, riders, restaurants) and risk showing something that doesn't
 * match what a trigger actually recorded.
 */
export function LiveActivityFeed({ initialEvents }: { initialEvents: ActivityLogRow[] }) {
  const [events, setEvents] = React.useState(initialEvents);

  React.useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("ops-activity-log")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_log" },
        (payload) => {
          setEvents((prev) => [payload.new as ActivityLogRow, ...prev].slice(0, 60));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="flex items-center gap-2 text-[12.5px] font-extrabold text-foreground">
          <Activity size={14} className="text-primary" /> Live Activity
        </p>
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-success">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> LIVE
        </span>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2" style={{ maxHeight: 560 }}>
        {events.length === 0 && (
          <p className="py-10 text-center text-[12px] text-muted-foreground">
            No activity yet — events will appear here in real time.
          </p>
        )}
        {events.map((e) => {
          const Icon = CATEGORY_ICON[e.category] ?? Info;
          const tone = SEVERITY_CLASSES[e.severity] ?? SEVERITY_CLASSES.blue;
          return (
            <div key={e.id} className="flex items-start gap-2.5 rounded-lg px-2.5 py-2">
              <div className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md", tone.bg)}>
                <Icon size={12} className={tone.fg} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] leading-snug text-foreground">{e.message}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{timeAgo(e.created_at)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
