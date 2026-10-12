"use client";

import * as React from "react";
import { Plus, Check, Flame, ChefHat } from "lucide-react";
import { Card } from "@chopnow/ui";
import { cn, formatNaira } from "@chopnow/lib";
import type { MockMenuItem } from "@/lib/data/restaurant-types";

export function MenuItemRow({
  item,
  onAdd,
  displayPrice,
}: {
  item: MockMenuItem;
  onAdd: () => void;
  displayPrice: number;
}) {
  const [justAdded, setJustAdded] = React.useState(false);
  const soldOut = !item.isAvailable;

  const handleAdd = () => {
    if (soldOut) return;
    onAdd();
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 700);
  };

  return (
    <Card className={cn("flex items-center gap-3 p-3", soldOut && "opacity-60")}>
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
        {item.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
        )}
        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="text-[9px] font-black text-white">SOLD OUT</span>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-[14px] font-bold leading-snug text-foreground">{item.name}</p>
          {item.badge === "popular" && (
            <span className="flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-primary">
              <Flame size={9} /> Popular
            </span>
          )}
          {item.badge === "chef" && (
            <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-secondary-foreground">
              <ChefHat size={9} /> Chef&apos;s Choice
            </span>
          )}
        </div>
        {item.description && (
          <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{item.description}</p>
        )}
        <p className="mt-1.5 text-[14px] font-extrabold text-foreground">{formatNaira(displayPrice)}</p>
      </div>
      <button
        onClick={handleAdd}
        disabled={soldOut}
        aria-label={`Add ${item.name}`}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 active:scale-90 disabled:opacity-30",
          justAdded
            ? "scale-110 bg-success text-white"
            : "bg-accent text-primary hover:bg-primary hover:text-primary-foreground",
        )}
      >
        {justAdded ? <Check size={18} strokeWidth={3} /> : <Plus size={18} strokeWidth={2.5} />}
      </button>
    </Card>
  );
}
