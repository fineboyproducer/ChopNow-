import type { Metadata } from "next";
import { Suspense } from "react";
import { HomeHero } from "@/components/customer/home-hero";
import { CategoryRow } from "@/components/customer/category-row";
import { FeaturedRestaurants } from "@/components/customer/featured-restaurants";
import { RestaurantGrid } from "@/components/customer/restaurant-grid";
import { SkeletonCard } from "@chopnow/ui";
import { getRestaurants } from "@/lib/data/restaurants";

export const metadata: Metadata = { title: "Order food in Ekpoma" };

export default async function HomePage() {
  const restaurants = await getRestaurants();

  return (
    <div>
      <HomeHero />
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <section className="mb-8 mt-8">
          <CategoryRow />
        </section>

        <Suspense fallback={<GridSkeleton />}>
          <FeaturedRestaurants />
        </Suspense>

        <section className="mb-10">
          <h2 className="mb-4 text-xl font-extrabold tracking-tight text-foreground">
            Restaurants near you
          </h2>
          <RestaurantGrid restaurants={restaurants} />
        </section>
      </div>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
