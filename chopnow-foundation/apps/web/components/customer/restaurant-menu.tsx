"use client";

import * as React from "react";
import { ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn, formatNaira } from "@chopnow/lib";
import { CATEGORIES, type MockRestaurant, type MockMenuItem } from "@/lib/data/restaurant-types";
import { useCart } from "@/lib/cart/cart-context";
import { MenuItemRow } from "./menu-item-row";

export function RestaurantMenu({
  restaurant,
}: {
  restaurant: MockRestaurant & { menu: MockMenuItem[] };
}) {
  const router = useRouter();
  const { addItem, itemCount, subtotal } = useCart();

  const categorySlugs = React.useMemo(
    () => Array.from(new Set(restaurant.menu.map((m) => m.categorySlug))),
    [restaurant.menu],
  );
  const [activeCategory, setActiveCategory] = React.useState(categorySlugs[0] ?? "");

  if (restaurant.status !== "open") return null;

  const total = subtotal;

  return (
    <div className="mx-auto max-w-3xl px-5 md:px-10">
      <div className="scrollbar-hide sticky top-16 z-10 -mx-5 mb-4 mt-6 flex gap-2 overflow-x-auto border-b border-border bg-background/95 px-5 py-3 backdrop-blur md:mx-0 md:px-0">
        {categorySlugs.map((slug) => (
          <button
            key={slug}
            onClick={() => setActiveCategory(slug)}
            className={cn(
              "shrink-0 rounded-full border-2 px-4 py-2 text-[13px] font-bold transition-colors",
              activeCategory === slug
                ? "border-secondary bg-secondary text-secondary-foreground"
                : "border-border bg-background text-foreground/80",
            )}
          >
            {CATEGORIES.find((c) => c.id === slug)?.name ?? slug}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {restaurant.menu
          .filter((m) => m.categorySlug === activeCategory)
          .map((item) => (
            <MenuItemRow
              key={item.id}
              item={item}
              onAdd={() => addItem(item, restaurant)}
              displayPrice={item.displayPrice}
            />
          ))}
      </div>

      {itemCount > 0 && (
        <button
          onClick={() => router.push("/checkout")}
          className="fixed bottom-24 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full bg-secondary py-2.5 pl-4 pr-2 text-secondary-foreground shadow-2xl transition-transform hover:scale-105 md:bottom-6"
        >
          <span className="flex items-center gap-2 text-sm font-bold">
            <ShoppingBag size={16} /> View cart
          </span>
          <span className="flex h-7 items-center rounded-full bg-primary px-3 text-sm font-extrabold text-primary-foreground">
            {formatNaira(total)}
          </span>
        </button>
      )}
    </div>
  );
}
