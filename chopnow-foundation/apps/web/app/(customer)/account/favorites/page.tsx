import type { Metadata } from "next";
import Link from "next/link";
import { Heart } from "lucide-react";
import { Card, EmptyState } from "@chopnow/ui";
import { getRestaurants } from "@/lib/data/restaurants";

export const metadata: Metadata = { title: "Your favourites" };

// ⚠️ Mock favourites for Sprint 2 UI — real version reads from
// `favorite_restaurants` for the signed-in customer.
const FAVORITE_IDS = ["r3"];

export default async function FavoritesPage() {
  const restaurants = await getRestaurants();
  const favorites = restaurants.filter((r) => FAVORITE_IDS.includes(r.id));

  if (favorites.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="No favourites yet"
        description="Tap the heart icon on any restaurant to save it here for quick access."
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {favorites.map((r) => (
        <Link key={r.id} href={`/restaurants/${r.slug}`}>
          <Card className="overflow-hidden">
            {r.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.coverUrl} alt={r.name} className="h-20 w-full object-cover" />
            )}
            <div className="p-2.5">
              <p className="truncate text-[12px] font-bold text-foreground">{r.name}</p>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
