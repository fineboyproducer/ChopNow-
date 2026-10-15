"use client";

import * as React from "react";
import { Power } from "lucide-react";
import { LogoMark } from "@chopnow/ui";
import { cn } from "@chopnow/lib";
import { setOnlineStatusAction } from "@/lib/actions/status";

export function RiderTopBar({ riderName, isOnline }: { riderName: string; isOnline: boolean }) {
  const [online, setOnline] = React.useState(isOnline);
  const [pending, setPending] = React.useState(false);

  const handleToggle = async () => {
    const next = !online;
    setOnline(next);
    setPending(true);
    const result = await setOnlineStatusAction(next);
    setPending(false);
    if (!result.success) setOnline(!next);
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-2">
        <LogoMark size={26} />
        <div>
          <p className="text-[12px] font-extrabold leading-none text-foreground">{riderName}</p>
          <p className="mt-0.5 text-[9.5px] leading-none text-muted-foreground">ChopNow Rider</p>
        </div>
      </div>
      <button
        onClick={handleToggle}
        disabled={pending}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-bold transition-colors disabled:opacity-60",
          online ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        <Power size={13} /> {online ? "Online" : "Offline"}
      </button>
    </header>
  );
}
