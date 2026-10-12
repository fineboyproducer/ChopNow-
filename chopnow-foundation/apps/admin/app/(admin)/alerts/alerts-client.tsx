"use client";

import * as React from "react";
import type { ElementType } from "react";
import { AlertTriangle, Bike, Store, CreditCard, XCircle, TrendingUp, Clock, Check } from "lucide-react";
import { Card, Button, EmptyState } from "@chopnow/ui";
import { createSupabaseBrowserClient, timeAgo, cn } from "@chopnow/lib";
import type { Database } from "@chopnow/lib/supabase/database.generated";
import { resolveAlertAction } from "@/lib/actions/alerts";

type AlertRow = Database["public"]["Tables"]["alerts"]["Row"];

const TYPE_ICON: Record<AlertRow["type"], ElementType> = {
  restaurant_delay: AlertTriangle,
  no_rider_accepted: Bike,
  customer_wait_exceeded: Clock,
  restaurant_offline: Store,
  rider_offline_midway: Bike,
  payment_failed: CreditCard,
  order_cancelled: XCircle,
  high_demand: TrendingUp,
};

const SEVERITY_CLASSES: Record<AlertRow["severity"], { bg: string; fg: string; border: string }> = {
  red: { bg: "bg-destructive/10", fg: "text-destructive", border: "border-destructive/30" },
  amber: { bg: "bg-warning/10", fg: "text-warning", border: "border-warning/30" },
  blue: { bg: "bg-info/10", fg: "text-info", border: "border-info/30" },
};

function AlertCard({ alert, onResolve }: { alert: AlertRow; onResolve?: (id: string) => void }) {
  const Icon = TYPE_ICON[alert.type] ?? AlertTriangle;
  const tone = SEVERITY_CLASSES[alert.severity];
  const [resolving, setResolving] = React.useState(false);

  const handleResolve = async () => {
    setResolving(true);
    const result = await resolveAlertAction(alert.id);
    setResolving(false);
    if (result.success) onResolve?.(alert.id);
  };

  return (
    <Card className={cn("flex items-center gap-3 border p-3.5", tone.border)}>
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", tone.bg)}>
        <Icon size={16} className={tone.fg} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-foreground">{alert.message}</p>
        <p className="text-[11px] text-muted-foreground">
          {timeAgo(alert.created_at)}
          {alert.resolved_at && ` · Resolved ${timeAgo(alert.resolved_at)}`}
        </p>
      </div>
      {onResolve && (
        <Button size="sm" variant="ghost" onClick={handleResolve} disabled={resolving}>
          <Check size={12} /> {resolving ? "..." : "Resolve"}
        </Button>
      )}
    </Card>
  );
}

export function AlertsClient({
  initialActiveAlerts,
  initialResolvedAlerts,
}: {
  initialActiveAlerts: AlertRow[];
  initialResolvedAlerts: AlertRow[];
}) {
  const [active, setActive] = React.useState(initialActiveAlerts);
  const [resolved, setResolved] = React.useState(initialResolvedAlerts);

  React.useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("ops-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts" },
        (payload) => setActive((prev) => [payload.new as AlertRow, ...prev]),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "alerts" },
        (payload) => {
          const updated = payload.new as AlertRow;
          if (updated.resolved_at) {
            setActive((prev) => prev.filter((a) => a.id !== updated.id));
            setResolved((prev) => [updated, ...prev].slice(0, 20));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleResolvedLocally = (id: string) => {
    setActive((prev) => {
      const found = prev.find((a) => a.id === id);
      if (found) setResolved((r) => [{ ...found, resolved_at: new Date().toISOString() }, ...r].slice(0, 20));
      return prev.filter((a) => a.id !== id);
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-3 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
          Active ({active.length})
        </p>
        {active.length === 0 ? (
          <EmptyState
            icon={Check}
            title="No active alerts"
            description="Operations are running smoothly — alerts will appear here in real time as they fire."
          />
        ) : (
          <div className="space-y-2">
            {active.map((alert) => (
              <AlertCard key={alert.id} alert={alert} onResolve={handleResolvedLocally} />
            ))}
          </div>
        )}
      </div>

      {resolved.length > 0 && (
        <div>
          <p className="mb-3 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
            Recently resolved
          </p>
          <div className="space-y-2 opacity-70">
            {resolved.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
