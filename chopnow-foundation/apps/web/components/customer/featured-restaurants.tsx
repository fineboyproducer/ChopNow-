import { Star } from "lucide-react";
import Link from "next/link";
import { Card } from "@chopnow/ui";
import { getFeaturedRestaurants } from "@/lib/data/restaurants";

export async function FeaturedRestaurants() {
  const restaurants = await getFeaturedRestaurants();
  if (restaurants.length === 0) return null;

  return (
    <section className="mb-8">
      <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary">
        Trending in Ekpoma
      </p>
      <h2 className="mb-4 text-xl font-extrabold tracking-tight text-foreground">
        Featured this week
      </h2>
      <div className="scrollbar-hide -mx-5 flex gap-4 overflow-x-auto px-5 pb-2 md:mx-0 md:px-0">
        {restaurants.map((r) => (
          <Link key={r.id} href={`/restaurants/${r.slug}`} className="shrink-0">
            <Card className="w-64 overflow-hidden transition-transform hover:-translate-y-1">
              <div className="h-32 overflow-hidden">
                {r.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.coverUrl} alt={r.name} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-bold text-foreground">{r.name}</p>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-0.5 font-semibold text-foreground">
                    <Star size={11} className="fill-primary text-primary" /> {r.rating}
                  </span>
                  <span>•</span>
                  <span>{r.etaMin} min</span>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
