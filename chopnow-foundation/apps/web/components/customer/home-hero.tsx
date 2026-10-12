"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Search, ChevronDown, ArrowRight } from "lucide-react";
import { Button } from "@chopnow/ui";

export function HomeHero() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSearch = () => {
    router.push(query.trim() ? `/discover?q=${encodeURIComponent(query)}` : "/discover");
  };

  return (
    <section className="relative overflow-hidden bg-accent">
      <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary/10 blur-2xl" />
      <div className="absolute -left-32 top-40 h-80 w-80 rounded-full bg-primary/5 blur-2xl" />

      <div className="relative mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-16">
        <p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
          <MapPin size={14} className="text-primary" />
          Delivering to <span className="font-bold text-foreground">Ekpoma, Edo State</span>
          <ChevronDown size={14} />
        </p>

        <h1 className="mb-3 max-w-lg text-[32px] font-black leading-[1.08] tracking-tight text-foreground md:text-5xl">
          Order. Relax. <span className="text-primary">Enjoy.</span>
        </h1>
        <p className="mb-7 max-w-md text-[15px] text-muted-foreground md:text-lg">
          Order from trusted restaurants near you — delivered hot, fast, and tracked live.
        </p>

        <div className="mb-4 flex flex-col gap-2 rounded-2xl bg-background p-1.5 shadow-[0_20px_50px_-12px_rgba(31,41,55,0.15)] sm:flex-row">
          <div className="flex flex-1 items-center gap-2 px-3">
            <Search size={17} className="shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search restaurants, jollof, shawarma..."
              className="min-w-0 flex-1 bg-transparent py-2.5 text-[14px] text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Button onClick={handleSearch} className="shrink-0">
            Order Now
          </Button>
        </div>

        <Button variant="secondary" asChild>
          <a href="/discover">
            Browse Restaurants <ArrowRight size={15} />
          </a>
        </Button>
      </div>
    </section>
  );
}
