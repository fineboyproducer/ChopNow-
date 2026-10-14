import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createSupabaseServerClient } from "@chopnow/lib";
import type { Database } from "@chopnow/lib/supabase/database.generated";
import { RestaurantDetailClient } from "./restaurant-detail-client";

type RestaurantRow = Database["public"]["Tables"]["restaurants"]["Row"];

export async function generateMetadata({
  params,
}: {
  // Next.js 15 passes dynamic route params as a Promise.
  params: Promise<{ restaurantId: string }>;
}): Promise<Metadata> {
  const { restaurantId } = await params;
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const { data } = await supabase.from("restaurants").select("name").eq("id", restaurantId).single();
  return { title: data?.name ?? "Restaurant" };
}

export default async function RestaurantDetailPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const { data: restaurantRow, error } = await supabase
    .from("restaurants")
    .select("*")
    .eq("id", restaurantId)
    .single();

  if (error || !restaurantRow) notFound();

  const { count: orderCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId);

  const { count: menuItemCount } = await supabase
    .from("menu_items")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId);

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
      <Link href="/restaurants" className="flex items-center gap-1.5 text-[13px] font-bold text-muted-foreground">
        <ChevronLeft size={16} /> Back to restaurants
      </Link>
      <RestaurantDetailClient
        restaurant={restaurantRow as RestaurantRow}
        orderCount={orderCount ?? 0}
        menuItemCount={menuItemCount ?? 0}
      />
    </div>
  );
}
