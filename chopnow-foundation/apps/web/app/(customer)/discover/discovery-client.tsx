"use client";

import * as React from "react";
import { Search, X, Filter } from "lucide-react";
import { RestaurantGrid } from "@/components/customer/restaurant-grid";
import { searchRestaurants } from "@/lib/data/restaurants";
import type { MockRestaurant } from "@/lib/data/restaurant-types";
import { cn } from "@chopnow/lib";
import { SkeletonCard } from "@chopnow/ui";

const SORT_OPTIONS = [
  { id: "nearest", label: "Nearest" },
  { id: "fastest", label: "Fastest Delivery" },
  { id: "rated", label: "Highest Rated" },
  { id: "cheapest", label: "Lowest Delivery Fee" },
] as const;

const FILTER_CHIPS = [
  { id: "open", label: "Open Now" },
  { id: "nigerian", label: "Nigerian Food" },
  { id: "fastfood", label: "Fast Food" },
  { id: "breakfast", label: "Breakfast" },
  { id: "latenight", label: "Late Night" },
  { id: "student", label: "Student Friendly" },
];

export function DiscoveryClient({
  initialRestaurants,
  initialQuery,
  initialCategory,
  initialSort,
  initialFilters,
}: {
  initialRestaurants: MockRestaurant[];
  initialQuery: string;
  initialCategory: string;
  initialSort: "nearest" | "fastest" | "rated" | "cheapest";
  initialFilters: string[];
}) {
  const [query, setQuery] = React.useState(initialQuery);
  const [category] = React.useState(initialCategory);
  const [sort, setSort] = React.useState(initialSort);
  const [filters, setFilters] = React.useState<string[]>(initialFilters);
  const [restaurants, setRestaurants] = React.useState(initialRestaurants);
  const [loading, setLoading] = React.useState(false);

  const toggleFilter = (id: string) =>
    setFilters((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const results = await searchRestaurants({ query, category, sort, filters });
      if (!cancelled) {
        setRestaurants(results);
        setLoading(false);
      }
    }, 250); // small debounce so typing doesn't refetch on every keystroke
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, category, sort, filters]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-6 md:px-8">
      <div className="mb-5">
        <h1 className="mb-1 text-2xl font-black tracking-tight text-foreground">
          Restaurants near you
        </h1>
        <p className="text-[13px] text-muted-foreground">
          Showing results closest to Ekpoma, Edo State
        </p>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-border bg-card p-1.5 shadow-[0_8px_24px_-10px_rgba(31,41,55,0.15)]">
        <Search size={17} className="ml-3 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search restaurants or dishes..."
          className="min-w-0 flex-1 bg-transparent py-2.5 text-[14px] text-foreground outline-none placeholder:text-muted-foreground"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="mr-1 flex h-7 w-7 items-center justify-center rounded-full bg-muted"
            aria-label="Clear search"
          >
            <X size={13} />
          </button>
        )}
      </div>

      <div className="scrollbar-hide mb-3 flex gap-2 overflow-x-auto pb-1">
        {SORT_OPTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSort(s.id)}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full border-2 px-3.5 py-2 text-[12.5px] font-bold transition-colors",
              sort === s.id
                ? "border-secondary bg-secondary text-secondary-foreground"
                : "border-border bg-background text-foreground/80",
            )}
          >
            <Filter size={11} /> {s.label}
          </button>
        ))}
      </div>

      <div className="scrollbar-hide mb-6 flex gap-2 overflow-x-auto pb-2">
        {FILTER_CHIPS.map((f) => (
          <button
            key={f.id}
            onClick={() => toggleFilter(f.id)}
            className={cn(
              "shrink-0 rounded-full border-2 px-3.5 py-2 text-[12.5px] font-bold transition-colors",
              filters.includes(f.id)
                ? "border-primary bg-accent text-primary"
                : "border-border bg-background text-foreground/80",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <RestaurantGrid
          restaurants={restaurants}
          emptyDescription={
            query
              ? `We couldn't find anything matching "${query}". Try a different search or clear your filters.`
              : "Try a different category or clear your filters."
          }
        />
      )}
    </div>
  );
}
