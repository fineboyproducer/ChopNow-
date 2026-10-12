import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Plus, Store } from "lucide-react";
import { Card, Button, EmptyState } from "@chopnow/ui";
import { createSupabaseServerClient, formatNaira } from "@chopnow/lib";
import type { Database } from "@chopnow/lib/supabase/database.generated";
import { RestaurantStatusToggle } from "./restaurant-status-toggle";

export const metadata: Metadata = { title: "Restaurants" };

type RestaurantRow = Database["public"]["Tables"]["restaurants"]["Row"];

export default async function RestaurantsPage() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const { data: restaurantRows } = await supabase.from("restaurants").select("*").order("name");
  const restaurants = (restaurantRows ?? []) as RestaurantRow[];

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-extrabold text-foreground">Restaurants</h1>
          <p className="text-[12px] text-muted-foreground">
            {restaurants.length} restaurant{restaurants.length !== 1 ? "s" : ""} onboarded
          </p>
        </div>
        <Button asChild>
          <Link href="/restaurants/new">
            <Plus size={15} /> Add restaurant
          </Link>
        </Button>
      </div>

      {restaurants.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No restaurants yet"
          description="Add your first restaurant to start accepting orders."
          action={
            <Button asChild>
              <Link href="/restaurants/new">Add restaurant</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {restaurants.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="mb-3 flex items-start gap-3">
                {r.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.logo_url} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <Link href={`/restaurants/${r.id}`} className="text-[14px] font-bold text-foreground hover:underline">
                    {r.name}
                  </Link>
                  <p className="text-[11px] text-muted-foreground">{r.category ?? "Uncategorized"}</p>
                </div>
              </div>

              <div className="mb-3 grid grid-cols-2 gap-2 text-[11.5px]">
                <div className="rounded-lg bg-muted px-2.5 py-2">
                  <p className="font-bold text-foreground">⭐ {r.rating || "—"}</p>
                  <p className="text-muted-foreground">{r.review_count} reviews</p>
                </div>
                <div className="rounded-lg bg-muted px-2.5 py-2">
                  <p className="font-bold text-foreground">{formatNaira(r.base_delivery_fee)}</p>
                  <p className="text-muted-foreground">Delivery fee</p>
                </div>
              </div>

              <RestaurantStatusToggle restaurantId={r.id} currentStatus={r.status} />

              <Link
                href={`/menus/${r.id}`}
                className="mt-2 block w-full rounded-lg border border-border py-2 text-center text-[12px] font-bold text-foreground transition-colors hover:bg-muted"
              >
                Manage menu
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
