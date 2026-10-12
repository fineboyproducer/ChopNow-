import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@chopnow/lib";
import type { Database } from "@chopnow/lib/supabase/database.generated";
import { OrdersListClient } from "./orders-list-client";

export const metadata: Metadata = { title: "Orders" };

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

export default async function OrdersPage() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const { data: orderRows } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  const orders = (orderRows ?? []) as OrderRow[];

  const restaurantIds = Array.from(new Set(orders.map((o) => o.restaurant_id)));
  const { data: restaurantRows } = restaurantIds.length
    ? await supabase.from("restaurants").select("id, name").in("id", restaurantIds)
    : { data: [] };
  const restaurantNameById = Object.fromEntries((restaurantRows ?? []).map((r) => [r.id, r.name]));

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-lg font-extrabold text-foreground">Orders</h1>
        <p className="text-[12px] text-muted-foreground">Most recent 100 orders across all restaurants</p>
      </div>
      <OrdersListClient orders={orders} restaurantNameById={restaurantNameById} />
    </div>
  );
}
