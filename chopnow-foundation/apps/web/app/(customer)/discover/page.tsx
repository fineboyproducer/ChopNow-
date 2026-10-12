import type { Metadata } from "next";
import { DiscoveryClient } from "./discovery-client";
import { searchRestaurants } from "@/lib/data/restaurants";

export const metadata: Metadata = { title: "Restaurants near you" };

interface DiscoverPageProps {
  // Next.js 15 passes route searchParams as a Promise.
  searchParams: Promise<{
    q?: string;
    category?: string;
    sort?: string;
    filters?: string;
  }>;
}

export default async function DiscoverPage({ searchParams }: DiscoverPageProps) {
  const resolvedSearchParams = await searchParams;
  const filters = resolvedSearchParams.filters ? resolvedSearchParams.filters.split(",") : [];
  const sort =
    (resolvedSearchParams.sort as "nearest" | "fastest" | "rated" | "cheapest") ?? "nearest";

  const restaurants = await searchRestaurants({
    query: resolvedSearchParams.q,
    category: resolvedSearchParams.category,
    sort,
    filters,
  });

  return (
    <DiscoveryClient
      initialRestaurants={restaurants}
      initialQuery={resolvedSearchParams.q ?? ""}
      initialCategory={resolvedSearchParams.category ?? ""}
      initialSort={sort}
      initialFilters={filters}
    />
  );
}
