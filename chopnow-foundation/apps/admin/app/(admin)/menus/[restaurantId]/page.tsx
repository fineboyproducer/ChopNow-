import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createSupabaseServerClient } from "@chopnow/lib";
import type { Database } from "@chopnow/lib/supabase/database.generated";
import { MenuManagementClient } from "./menu-management-client";

type MenuCategoryRow = Database["public"]["Tables"]["menu_categories"]["Row"];
type MenuItemRow = Database["public"]["Tables"]["menu_items"]["Row"];

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
  return { title: data ? `${data.name} · Menu` : "Menu" };
}

export default async function MenuManagementPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const { data: restaurant, error } = await supabase
    .from("restaurants")
    .select("id, name")
    .eq("id", restaurantId)
    .single();

  if (error || !restaurant) notFound();

  const [{ data: categoryRows }, { data: itemRows }] = await Promise.all([
    supabase.from("menu_categories").select("*").eq("restaurant_id", restaurantId).order("sort_order"),
    supabase.from("menu_items").select("*").eq("restaurant_id", restaurantId).order("sort_order"),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-6">
      <Link href={`/restaurants/${restaurantId}`} className="flex items-center gap-1.5 text-[13px] font-bold text-muted-foreground">
        <ChevronLeft size={16} /> Back to {restaurant.name}
      </Link>
      <div>
        <h1 className="text-lg font-extrabold text-foreground">{restaurant.name} — Menu</h1>
        <p className="text-[12px] text-muted-foreground">
          Manage categories, items, prices, and availability on behalf of this restaurant (PRD Section 9.2/9.3).
        </p>
      </div>

      <MenuManagementClient
        restaurantId={restaurantId}
        initialCategories={(categoryRows ?? []) as MenuCategoryRow[]}
        initialItems={(itemRows ?? []) as MenuItemRow[]}
      />
    </div>
  );
}
