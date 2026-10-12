"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, Heart, Star, Clock, Bike, Store } from "lucide-react";
import { EmptyState, Button } from "@chopnow/ui";
import { formatNaira } from "@chopnow/lib";
import type { MockRestaurant, MockMenuItem } from "@/lib/data/restaurant-types";

export function RestaurantHeader({
  restaurant,
}: {
  restaurant: MockRestaurant & { menu: MockMenuItem[] };
}) {
  const [isFavorite, setIsFavorite] = useState(false);

  if (restaurant.status !== "open") {
    return (
      <div className="mx-auto max-w-3xl px-5 py-8 md:px-10">
        <Link
          href="/discover"
          className="mb-6 flex items-center gap-1.5 text-sm font-bold text-muted-foreground"
        >
          <ChevronLeft size={16} /> Back
        </Link>
        <EmptyState
          icon={Store}
          title={`${restaurant.name} is closed`}
          description={
            restaurant.status === "busy"
              ? "This restaurant is currently too busy to accept new orders. Try again shortly."
              : "This restaurant isn't accepting orders right now. Check back later, or browse other open restaurants nearby."
          }
          action={
            <Button asChild>
              <Link href="/discover">Browse other restaurants</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <div className="relative h-56 md:h-72">
        {restaurant.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={restaurant.coverUrl} alt={restaurant.name} className="h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/30" />
        <Link
          href="/discover"
          className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-background/95 shadow"
        >
          <ChevronLeft size={19} />
        </Link>
        <button
          onClick={() => setIsFavorite((f) => !f)}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-background/95 shadow transition-transform active:scale-90"
          aria-label="Toggle favourite"
        >
          <Heart size={17} className={isFavorite ? "fill-primary text-primary" : "text-foreground"} />
        </button>
        {restaurant.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={restaurant.logoUrl}
            alt=""
            className="absolute -bottom-8 left-5 h-16 w-16 rounded-2xl border-4 border-background object-cover shadow-lg"
          />
        )}
      </div>

      <div className="mx-auto max-w-3xl px-5 pt-11 md:px-10">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">{restaurant.name}</h1>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{restaurant.category}</p>
          </div>
          <span className="rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-bold text-success">
            Open now
          </span>
        </div>

        <p className="mt-3 text-[14px] leading-relaxed text-foreground/80">{restaurant.description}</p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2.5 rounded-xl bg-muted p-3">
            <Star size={16} className="fill-primary text-primary" />
            <div>
              <p className="text-sm font-bold text-foreground">{restaurant.rating}</p>
              <p className="text-[10px] text-muted-foreground">{restaurant.reviews} reviews</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl bg-muted p-3">
            <Clock size={16} className="text-primary" />
            <div>
              <p className="text-sm font-bold text-foreground">{restaurant.etaMin} min</p>
              <p className="text-[10px] text-muted-foreground">Delivery time</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl bg-muted p-3">
            <Bike size={16} className="text-primary" />
            <div>
              <p className="text-sm font-bold text-foreground">
                {formatNaira(restaurant.baseDeliveryFee)}
              </p>
              <p className="text-[10px] text-muted-foreground">Delivery fee</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl bg-muted p-3">
            <Clock size={16} className="text-primary" />
            <div>
              <p className="text-[12px] font-bold text-foreground">
                {restaurant.openingHours?.mon
                  ? `${restaurant.openingHours.mon.open} – ${restaurant.openingHours.mon.close}`
                  : "See hours"}
              </p>
              <p className="text-[10px] text-muted-foreground">Opening hours</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
