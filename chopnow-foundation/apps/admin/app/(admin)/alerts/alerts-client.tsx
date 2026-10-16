"use client";

import * as React from "react";
import type { ElementType } from "react";
import Link from "next/link";
import { AlertTriangle, Bike, Store, CreditCard, XCircle, TrendingUp, Clock, Check, RefreshCw, Banknote } from "lucide-react";
import { Card, Button, EmptyState } from "@chopnow/ui";
import { createSupabaseBrowserClient, timeAgo, formatDateTime, cn } from "@chopnow/lib";
import { resolveAlertAction, runAlertCheckAction } from "@/lib/actions/alerts";
import {
  ALERT_SEVERITY_LABELS, ALERT_STATE_LABELS, ALERT_TYPE_LABELS, SUPERSEDED_EXPLANATION, applyAlertChange, getAlertState, getAlertTitle, type AlertRow,
} from "@/lib/alerts/alert-meta";

const TYPE_ICON: Record<AlertRow["type"], ElementType> = {
  restaurant_delay: AlertTriangle,
  no_rider_accepted: Bike,
  rider_delay: Bike,
  customer_wait_exceeded: Clock,
  paid_order_stuck: Banknote,
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

function AlertCard({
  alert,
  orderNumber,
  onResolve,
}: {
  alert: AlertRow;
  orderNumber?: string;
  onResolve?: (id: string) => void;
}) {
  const Icon = TYPE_ICON[alert.type] ?? AlertTriangle;
  const tone = SEVERITY_CLASSES[alert.severity];
  const state = getAlertState(alert);
  const [resolving, setResolving] = React.useState(false);

  const handleResolve = async () => {
    setResolving(true);
    const result = await resolveAlertAction(alert.id);
    setResolving(false);
    if (result.success) onResolve?.(alert.id);
  };

  return (
    <Card className={cn("border p-3.5", tone.border)}>
      <div className="flex items-start gap-3">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", tone.bg)}>
          <Icon size={16} className={tone.fg} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[12.5px] font-extrabold text-foreground">{getAlertTitle(alert)}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", tone.bg, tone.fg)}>
              {ALERT_SEVERITY_LABELS[alert.severity]}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
              {ALERT_TYPE_LABELS[alert.type] ?? alert.type}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold",
                state === "active"
                  ? "bg-destructive/10 text-destructive"
                  : state === "superseded"
                    ? "bg-warning/10 text-warning"
                    : "bg-success/10 text-success",
              )}
            >
              {ALERT_STATE_LABELS[state]}
            </span>
          </div>
          <p className="mt-1 break-words text-[13px] text-foreground">{alert.message}</p>
          {state === "superseded" && (
            <p className="mt-1 text-[12px] font-semibold text-warning">{SUPERSEDED_EXPLANATION}</p>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">
            {alert.order_id && (
              <Link href={`/orders?highlight=${alert.order_id}`} className="font-bold text-primary hover:underline">
                {orderNumber ?? "View order"}
              </Link>
            )}
            {alert.order_id && " · "}
            <span title={formatDateTime(alert.created_at)}>Raised {timeAgo(alert.created_at)}</span>
            {alert.resolved_at && (
              <> · {state === "superseded" ? "Superseded" : "Resolved"} {timeAgo(alert.resolved_at)}</>
            )}
          </p>
        </div>
      </div>
      {onResolve && (
        <div className="mt-3 flex sm:justify-end">
          <Button size="sm" variant="ghost" className="w-full sm:w-auto" onClick={handleResolve} disabled={resolving}>
            <Check size={12} /> {resolving ? "..." : "Resolve"}
          </Button>
        </div>
      )}
    </Card>
  );
}

export function AlertsClient({
  initialActiveAlerts,
  initialResolvedAlerts,
  initialOrderNumbers,
  schedulerProblem,
}: {
  initialActiveAlerts: AlertRow[];
  initialResolvedAlerts: AlertRow[];
  initialOrderNumbers: Record<string, string>;
  /** Set when automatic generation is not running; null/undefined when healthy or unknown. */
  schedulerProblem?: string | null;
}) {
  const [lists, setLists] = React.useState({ active: initialActiveAlerts, resolved: initialResolvedAlerts });
  const [orderNumbers, setOrderNumbers] = React.useState(initialOrderNumbers);
  const [checking, setChecking] = React.useState(false);
  const [checkMessage, setCheckMessage] = React.useState<string | null>(null);
  const { active, resolved } = lists;

  React.useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const onChange = (payload: { new: unknown }) => {
      const row = payload.new as AlertRow;
      setLists((prev) => applyAlertChange(prev, row));
      if (row.order_id) {
        const orderId = row.order_id;
        supabase
          .from("orders")
          .select("order_number")
          .eq("id", orderId)
          .maybeSingle()
          .then(({ data }) => {
            if (data) setOrderNumbers((prev) => (prev[orderId] ? prev : { ...prev, [orderId]: data.order_number }));
          });
      }
    };
    const channel = supabase
      .channel("ops-alerts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alerts" }, onChange)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "alerts" }, onChange)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleResolvedLocally = (id: string) => {
    setLists((prev) => {
      const found = prev.active.find((a) => a.id === id);
      return found ? applyAlertChange(prev, { ...found, resolved_at: new Date().toISOString(), resolved_by: found.resolved_by ?? "me" }) : prev;
    });
  };

  const handleCheckNow = async () => {
    setChecking(true);
    setCheckMessage(null);
    const result = await runAlertCheckAction();
    setChecking(false);
    setCheckMessage(
      result.success
        ? `Check complete: ${result.data.created} new, ${result.data.reopened} reopened, ${result.data.resolved} cleared.`
        : result.error.message,
    );
  };

  return (
    <div className="space-y-5">
      {schedulerProblem && (
        <Card className="border-warning/40 bg-warning/10 p-3.5">
          <p className="text-[12.5px] font-extrabold text-foreground">Automatic alert checks are not running</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {schedulerProblem}. New alerts will only appear when someone presses &ldquo;Check now&rdquo; until the
            scheduled job is fixed (see the bottom of migration 0013).
          </p>
        </Card>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={handleCheckNow} disabled={checking}>
          <RefreshCw size={12} className={checking ? "animate-spin" : ""} /> {checking ? "Checking..." : "Check now"}
        </Button>
        {checkMessage && <p className="text-[11.5px] text-muted-foreground">{checkMessage}</p>}
      </div>

      <div>
        <p className="mb-3 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
          Active ({active.length})
        </p>
        {active.length === 0 ? (
          <EmptyState
            icon={Check}
            title="No active alerts"
            description="Nothing is overdue. Alerts are raised automatically when an order is stuck, and appear here in real time."
          />
        ) : (
          <div className="space-y-2">
            {active.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                orderNumber={alert.order_id ? orderNumbers[alert.order_id] : undefined}
                onResolve={handleResolvedLocally}
              />
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
              <AlertCard
                key={alert.id}
                alert={alert}
                orderNumber={alert.order_id ? orderNumbers[alert.order_id] : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
