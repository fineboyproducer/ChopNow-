import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@chopnow/lib";
import type { Database } from "@chopnow/lib/supabase/database.generated";
import { RidersClient } from "./riders-client";

export const metadata: Metadata = { title: "Riders" };

type RiderRow = Database["public"]["Tables"]["riders"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export default async function RidersPage() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const { data: riderRows } = await supabase.from("riders").select("*").order("is_online", { ascending: false });
  const riders = (riderRows ?? []) as RiderRow[];

  const riderIds = riders.map((r) => r.id);
  const { data: profileRows } = riderIds.length
    ? await supabase.from("profiles").select("*").in("id", riderIds)
    : { data: [] };
  const profileById = new Map<string, ProfileRow>((profileRows ?? []).map((p) => [p.id, p]));

  const { data: ordersInFlight } = await supabase
    .from("orders")
    .select("id, order_number, restaurant_id, rider_id")
    .not("rider_id", "is", null)
    .in("status", ["rider_assigned", "rider_enroute_restaurant", "picked_up", "heading_to_customer"]);

  const orderByRiderId = new Map<string, { id: string; order_number: string }>(
    (ordersInFlight ?? []).map((o) => [o.rider_id as string, o]),
  );

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-extrabold text-foreground">Riders</h1>
        <p className="text-[12px] text-muted-foreground">
          {riders.filter((r) => r.is_online).length} online · {riders.length} total
        </p>
      </div>

      <RidersClient
        riders={riders.map((r) => ({
          rider: r,
          name: profileById.get(r.id)?.full_name ?? "Unnamed rider",
          phone: profileById.get(r.id)?.phone ?? null,
          currentOrder: orderByRiderId.get(r.id) ?? null,
        }))}
      />
    </div>
  );
}
