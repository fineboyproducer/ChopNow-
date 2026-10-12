import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createSupabaseServerClient, scoreRider, haversineDistanceKm } from "@chopnow/lib";
import type { Database } from "@chopnow/lib/supabase/database.generated";
import { DispatchClient } from "./dispatch-client";

export const metadata: Metadata = { title: "Dispatch" };

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type RiderRow = Database["public"]["Tables"]["riders"]["Row"];
type RestaurantRow = Database["public"]["Tables"]["restaurants"]["Row"];

// Orders in these stages are the ones dispatch actually needs to act on:
// cooked and waiting for a rider, or already assigned but worth reviewing.
// `as const` keeps this a literal-string tuple rather than widening to
// plain string[], which Supabase's typed .in("status", …) call requires
// since `status` is the OrderStatusEnum literal union, not a bare string.
const DISPATCHABLE_STATUSES = ["ready_for_pickup", "rider_assigned"] as const;

export default async function DispatchPage() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const { data: orderRows } = await supabase
    .from("orders")
    .select("*")
    .in("status", DISPATCHABLE_STATUSES)
    .order("created_at", { ascending: true });

  const orders = (orderRows ?? []) as OrderRow[];

  const { data: riderRows } = await supabase.from("riders").select("*").eq("is_active", true);
  const riders = (riderRows ?? []) as RiderRow[];

  const restaurantIds = Array.from(new Set(orders.map((o) => o.restaurant_id)));
  const { data: restaurantRows } = restaurantIds.length
    ? await supabase.from("restaurants").select("*").in("id", restaurantIds)
    : { data: [] };
  const restaurantById = new Map<string, RestaurantRow>((restaurantRows ?? []).map((r) => [r.id, r as RestaurantRow]));

  const { data: profileRows } = riders.length
    ? await supabase
        .from("profiles")
        .select("id, full_name")
        .in(
          "id",
          riders.map((r) => r.id),
        )
    : { data: [] };
  const riderNameById = new Map<string, string>((profileRows ?? []).map((p) => [p.id, p.full_name ?? "Unnamed rider"]));

  // Pre-compute rider scores for each dispatchable order server-side, so
  // the client component receives ready-to-render rankings rather than
  // needing its own Supabase queries just to display a score breakdown.
  const orderCandidates = orders.map((order) => {
    const restaurant = restaurantById.get(order.restaurant_id);
    const ranked = riders
      .filter((r) => r.is_online)
      .map((rider) => {
        const distanceKm = restaurant
          ? haversineDistanceKm(
              { lat: Number(restaurant.lat), lng: Number(restaurant.lng) },
              { lat: Number(rider.current_lat ?? restaurant.lat), lng: Number(rider.current_lng ?? restaurant.lng) },
            )
          : 0;
        const score = scoreRider({
          distanceToRestaurantKm: distanceKm,
          online: rider.is_online,
          status: rider.status,
          rating: Number(rider.rating),
          acceptanceRate: Number(rider.acceptance_rate),
        });
        return { rider, name: riderNameById.get(rider.id) ?? "Unnamed rider", distanceKm, score };
      })
      .sort((a, b) => b.score.total - a.score.total);

    return {
      order,
      restaurantName: restaurant?.name ?? "Unknown restaurant",
      candidates: ranked,
    };
  });

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-lg font-extrabold text-foreground">Dispatch</h1>
        <p className="text-[12px] text-muted-foreground">
          Automatic rider matching for orders ready for pickup, per the Operations & Dispatch
          Architecture, Section 1.2.
        </p>
      </div>

      <DispatchClient orderCandidates={orderCandidates} />
    </div>
  );
}
