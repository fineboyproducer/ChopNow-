import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@chopnow/lib";
import type { Database } from "@chopnow/lib/supabase/database.generated";
import { PipelineClient } from "./pipeline-client";

export const metadata: Metadata = { title: "Pipeline" };

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type StageSlaRow = Database["public"]["Tables"]["stage_sla_config"]["Row"];

// `as const` keeps this a literal-string tuple rather than widening to
// plain string[], which Supabase's typed .in("status", …) call requires.
const ACTIVE_STATUSES = [
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
] as const;

export default async function PipelinePage() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const [{ data: orderRows }, { data: slaRows }, { data: historyRows }] = await Promise.all([
    supabase.from("orders").select("*").in("status", ACTIVE_STATUSES).order("created_at", { ascending: true }),
    supabase.from("stage_sla_config").select("*"),
    supabase
      .from("order_status_history")
      .select("order_id, status, changed_at, handler_type")
      .order("changed_at", { ascending: false }),
  ]);

  const orders = (orderRows ?? []) as OrderRow[];
  const slaByStage = new Map<string, number>(((slaRows ?? []) as StageSlaRow[]).map((s) => [s.stage, s.sla_seconds]));

  // Most recent status-history row per order gives us the exact moment
  // each order entered its current stage — the pipeline's "time in
  // stage" display depends on this being precise, not approximated from
  // orders.created_at (which only reflects the order's original
  // creation, not its most recent transition).
  const stageEnteredAtByOrder = new Map<string, string>();
  for (const row of historyRows ?? []) {
    if (!stageEnteredAtByOrder.has(row.order_id)) {
      stageEnteredAtByOrder.set(row.order_id, row.changed_at);
    }
  }

  const restaurantIds = Array.from(new Set(orders.map((o) => o.restaurant_id)));
  const { data: restaurantRows } = restaurantIds.length
    ? await supabase.from("restaurants").select("id, name").in("id", restaurantIds)
    : { data: [] };
  const restaurantNameById = new Map<string, string>((restaurantRows ?? []).map((r) => [r.id, r.name]));

  const riderIds = Array.from(new Set(orders.map((o) => o.rider_id).filter((id): id is string => !!id)));
  const { data: riderProfiles } = riderIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", riderIds)
    : { data: [] };
  const riderNameById = new Map<string, string>((riderProfiles ?? []).map((p) => [p.id, p.full_name ?? "Rider"]));

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-extrabold text-foreground">Order Pipeline</h1>
        <p className="text-[12px] text-muted-foreground">
          {orders.length} order{orders.length !== 1 ? "s" : ""} in flight — per PRD Section 8, the
          14-stage order lifecycle
        </p>
      </div>

      <PipelineClient
        orders={orders.map((o) => ({
          order: o,
          restaurantName: restaurantNameById.get(o.restaurant_id) ?? "Unknown restaurant",
          riderName: o.rider_id ? (riderNameById.get(o.rider_id) ?? "Rider") : null,
          stageEnteredAt: stageEnteredAtByOrder.get(o.id) ?? o.created_at,
        }))}
        slaByStage={Object.fromEntries(slaByStage)}
      />
    </div>
  );
}
