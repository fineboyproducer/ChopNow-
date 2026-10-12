"use client";

import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/data/restaurant-types";

export function CategoryRow() {
  const router = useRouter();

  return (
    <div>
      <h2 className="mb-4 text-xl font-extrabold tracking-tight text-foreground">
        Popular categories
      </h2>
      <div className="scrollbar-hide -mx-5 flex gap-3 overflow-x-auto px-5 pb-2 md:mx-0 md:flex-wrap md:px-0">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => router.push(`/discover?category=${c.id}`)}
            className="group flex w-[74px] shrink-0 flex-col items-center gap-2"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-transparent bg-muted text-2xl transition-all group-hover:border-primary/40 group-hover:bg-accent">
              {c.emoji}
            </div>
            <span className="text-center text-[11px] font-bold text-foreground/80">{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
