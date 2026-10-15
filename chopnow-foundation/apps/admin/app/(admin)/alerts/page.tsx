import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@chopnow/lib";
import type { Database } from "@chopnow/lib/supabase/database.generated";
import { AlertsClient } from "./alerts-client";

export const metadata: Metadata = { title: "Alerts" };

type AlertRow = Database["public"]["Tables"]["alerts"]["Row"];

export default async function AlertsPage() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const [{ data: activeAlerts }, { data: resolvedAlerts }] = await Promise.all([
    supabase.from("alerts").select("*").is("resolved_at", null).order("created_at", { ascending: false }),
    supabase
      .from("alerts")
      .select("*")
      .not("resolved_at", "is", null)
      .order("resolved_at", { ascending: false })
      .limit(20),
  ]);

  // null = healthy, or unknown (e.g. migration 0013 not applied yet): show nothing.
  let schedulerProblem: string | null = null;
  const { data: scheduler } = await supabase.rpc("operational_alerts_scheduler_status");
  if (scheduler && scheduler.running === false) {
    schedulerProblem = scheduler.reason ? `Reason: ${scheduler.reason}` : "The scheduled job is not running";
  }

  const orderIds = [...new Set([...(activeAlerts ?? []), ...(resolvedAlerts ?? [])].map((a) => a.order_id).filter((id): id is string => !!id))];
  const orderNumberById: Record<string, string> = {};
  if (orderIds.length > 0) {
    const { data: orders } = await supabase.from("orders").select("id, order_number").in("id", orderIds);
    for (const o of orders ?? []) orderNumberById[o.id] = o.order_number;
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-extrabold text-foreground">Alerts</h1>
        <p className="text-[12px] text-muted-foreground">
          Raised automatically every minute when an order is stuck or overdue, and cleared when it moves on.
        </p>
      </div>

      <AlertsClient
        initialActiveAlerts={(activeAlerts ?? []) as AlertRow[]}
        initialResolvedAlerts={(resolvedAlerts ?? []) as AlertRow[]}
        initialOrderNumbers={orderNumberById}
        schedulerProblem={schedulerProblem}
      />
    </div>
  );
}
