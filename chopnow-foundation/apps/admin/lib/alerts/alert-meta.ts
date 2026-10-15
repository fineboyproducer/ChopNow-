import type { Database } from "@chopnow/lib/supabase/database.generated";

export type AlertRow = Database["public"]["Tables"]["alerts"]["Row"];
export type AlertType = AlertRow["type"];

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  restaurant_delay: "Restaurant delay",
  no_rider_accepted: "Awaiting rider",
  rider_delay: "Rider delay",
  customer_wait_exceeded: "Delivery overdue",
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

export type AlertState = "active" | "auto_resolved" | "resolved_by_staff";

/**
 * resolved_by is set only when a person resolves an alert; the generator
 * (0013) leaves it null when it closes one because the incident cleared.
 */
export function getAlertState(alert: Pick<AlertRow, "resolved_at" | "resolved_by">): AlertState {
  if (!alert.resolved_at) return "active";
  return alert.resolved_by ? "resolved_by_staff" : "auto_resolved";
}

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
