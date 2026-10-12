import { SearchX } from "lucide-react";
import { EmptyState } from "@chopnow/ui";
import { RestaurantCard } from "./restaurant-card";
import type { MockRestaurant } from "@/lib/data/restaurant-types";

export function RestaurantGrid({
  restaurants,
  emptyTitle = "No restaurants found",
  emptyDescription = "Try a different search or clear your filters.",
}: {
  restaurants: MockRestaurant[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (restaurants.length === 0) {
    return <EmptyState icon={SearchX} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {restaurants.map((r) => (
        <RestaurantCard key={r.id} restaurant={r} />
      ))}
    </div>
  );
}
