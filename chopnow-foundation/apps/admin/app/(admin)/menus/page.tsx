import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";
import { Card, EmptyState } from "@chopnow/ui";
import { createSupabaseServerClient } from "@chopnow/lib";

export const metadata: Metadata = { title: "Menus" };

export default async function MenusIndexPage() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const { data: restaurantRows } = await supabase.from("restaurants").select("id, name, logo_url, category").order("name");
  const restaurants = restaurantRows ?? [];

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-lg font-extrabold text-foreground">Menus</h1>
        <p className="text-[12px] text-muted-foreground">Choose a restaurant to manage its menu.</p>
      </div>

      {restaurants.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="No restaurants yet"
          description="Add a restaurant first before managing its menu."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {restaurants.map((r) => (
            <Link key={r.id} href={`/menus/${r.id}`}>
              <Card className="flex items-center gap-3 p-4">
                {r.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.logo_url} alt="" className="h-11 w-11 rounded-xl object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-foreground">{r.name}</p>
                  <p className="text-[11px] text-muted-foreground">{r.category ?? "Uncategorized"}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
