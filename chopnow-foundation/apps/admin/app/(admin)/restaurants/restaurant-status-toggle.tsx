"use client";

import * as React from "react";
import { cn } from "@chopnow/lib";
import { setRestaurantStatusAction } from "@/lib/actions/restaurants";

const STATUSES = [
  { id: "open", label: "Open" },
  { id: "busy", label: "Busy" },
  { id: "offline", label: "Offline" },
] as const;

export function RestaurantStatusToggle({
  restaurantId,
  currentStatus,
}: {
  restaurantId: string;
  currentStatus: string;
}) {
  const [status, setStatus] = React.useState(currentStatus);
  const [pending, setPending] = React.useState(false);

  const handleChange = async (newStatus: (typeof STATUSES)[number]["id"]) => {
    if (newStatus === status) return;
    const previous = status;
    setStatus(newStatus); // optimistic
    setPending(true);
    const result = await setRestaurantStatusAction(restaurantId, newStatus);
    setPending(false);
    if (!result.success) setStatus(previous); // roll back on failure
  };

  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1">
      {STATUSES.map((s) => (
        <button
          key={s.id}
          onClick={() => handleChange(s.id)}
          disabled={pending}
          className={cn(
            "flex-1 rounded-md py-1.5 text-[11px] font-bold transition-colors disabled:opacity-50",
            status === s.id
              ? s.id === "open"
                ? "bg-success text-success-foreground"
                : s.id === "busy"
                  ? "bg-warning text-warning-foreground"
                  : "bg-destructive text-destructive-foreground"
              : "text-muted-foreground hover:bg-background",
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
