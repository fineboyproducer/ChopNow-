import type { Database } from "@chopnow/lib/supabase/database.generated";

export type AlertRow = Database["public"]["Tables"]["alerts"]["Row"];
export type AlertType = AlertRow["type"];

/**
 * Category chip shown next to an alert's headline. For the automated alerts
 * these name the part of the flow involved, not who is at fault: there is no
 * restaurant app, so a restaurant-stage alert means ops needs to act.
 */
export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  restaurant_delay: "Restaurant stage",
  no_rider_accepted: "Dispatch",
  rider_delay: "Delivery",
  customer_wait_exceeded: "Customer wait",
  paid_order_stuck: "Payment",
  restaurant_offline: "Restaurant offline",
  rider_offline_midway: "Rider offline mid-delivery",
  payment_failed: "Payment failed",
  order_cancelled: "Order cancelled",
  high_demand: "High demand",
};

export const ALERT_SEVERITY_LABELS: Record<AlertRow["severity"], string> = {
  red: "Critical",
  amber: "Warning",
  blue: "Info",
};

/** Headline: the generator's title when present, otherwise the category label. */
export function getAlertTitle(alert: Pick<AlertRow, "title" | "type">): string {
  return alert.title ?? ALERT_TYPE_LABELS[alert.type] ?? alert.type;
}

export type AlertState = "active" | "auto_resolved" | "superseded" | "resolved_by_staff";

/**
 * resolved_by is set only when a person resolves an alert; the generator
 * (0013) leaves it null when it closes one because the incident cleared.
 */
export function getAlertState(
  alert: Pick<AlertRow, "resolved_at" | "resolved_by" | "resolution_reason">,
): AlertState {
  if (!alert.resolved_at) return "active";
  if (alert.resolved_by) return "resolved_by_staff";
  // Folded into the red "Customer waiting too long" alert: NOT cleared.
  return alert.resolution_reason === "superseded" ? "superseded" : "auto_resolved";
}

/** Chip text and explanation per state. A superseded alert is deliberately not "resolved". */
export const ALERT_STATE_LABELS: Record<AlertState, string> = {
  active: "Active",
  auto_resolved: "Resolved automatically",
  superseded: "Superseded by Customer waiting too long",
  resolved_by_staff: "Resolved by staff",
};

export const SUPERSEDED_EXPLANATION =
  "This alert was folded into the red \"Customer waiting too long\" alert for the same order. The order is still delayed; follow that alert.";

export interface AlertLists {
  active: AlertRow[];
  resolved: AlertRow[];
}

export const RESOLVED_LIST_LIMIT = 20;

/**
 * Applies one realtime INSERT/UPDATE row to the two lists. Idempotent (the
 * same row delivered twice, or already added by a local resolve, never
 * duplicates) and handles an auto-resolved alert being reopened by the
 * generator (resolved_at back to null moves it from resolved to active).
 */
export function applyAlertChange({ active, resolved }: AlertLists, row: AlertRow): AlertLists {
  const rest = (list: AlertRow[]) => list.filter((a) => a.id !== row.id);
  if (row.resolved_at) {
    return {
      active: rest(active),
      resolved: [row, ...rest(resolved)]
        .sort((a, b) => (b.resolved_at ?? "").localeCompare(a.resolved_at ?? ""))
        .slice(0, RESOLVED_LIST_LIMIT),
    };
  }
  return {
    active: [row, ...rest(active)].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    resolved: rest(resolved),
  };
}
