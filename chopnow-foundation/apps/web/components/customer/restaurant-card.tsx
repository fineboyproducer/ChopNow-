import Link from "next/link";
import { Star, Clock, Flame, Bike } from "lucide-react";
import { Card } from "@chopnow/ui";
import { formatDistance, formatNaira } from "@chopnow/lib";
import type { MockRestaurant } from "@/lib/data/restaurant-types";

export function RestaurantCard({ restaurant }: { restaurant: MockRestaurant }) {
  return (
    <Link href={`/restaurants/${restaurant.slug}`}>
      <Card className="group overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_36px_-10px_rgba(31,41,55,0.16)]">
        <div className="relative h-44 overflow-hidden">
          {restaurant.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={restaurant.coverUrl}
              alt={restaurant.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          <div className="absolute left-2.5 top-2.5 flex gap-1.5">
            {restaurant.isFeatured && (
              <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-secondary-foreground">
                <Flame size={11} /> Featured
              </span>
            )}
            {restaurant.status !== "open" && (
              <span className="rounded-full bg-destructive px-2.5 py-1 text-[11px] font-bold text-destructive-foreground">
                Closed
              </span>
            )}
          </div>
          {restaurant.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={restaurant.logoUrl}
              alt=""
              className="absolute -bottom-4 left-4 h-11 w-11 rounded-xl border-[3px] border-background object-cover shadow-md"
            />
          )}
        </div>
        <div className="p-4 pt-6">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[15px] font-extrabold leading-tight text-foreground">
              {restaurant.name}
            </p>
            <span
              className={
                restaurant.status === "open"
                  ? "mt-0.5 shrink-0 text-[10.5px] font-bold text-success"
                  : "mt-0.5 shrink-0 text-[10.5px] font-bold text-destructive"
              }
            >
              {restaurant.status === "open" ? "● Open" : "● Closed"}
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{restaurant.category}</p>
          <div className="mt-2.5 flex items-center gap-2.5 text-[12px] text-foreground/80">
            <span className="flex items-center gap-1 font-bold text-foreground">
              <Star size={12} className="fill-primary text-primary" /> {restaurant.rating}
            </span>
            <span className="text-border">•</span>
            <span className="flex items-center gap-1">
              <Clock size={12} /> {restaurant.etaMin} min
            </span>
            <span className="text-border">•</span>
            <span>{formatDistance(restaurant.distanceKm)}</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-dashed border-border pt-2.5">
            <span className="flex items-center gap-1 text-[11.5px] text-muted-foreground">
              <Bike size={12} /> {formatNaira(restaurant.baseDeliveryFee)} delivery
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
