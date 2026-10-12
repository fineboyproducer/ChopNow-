"use client";

import { useEffect, useRef } from "react";
import { recordLocationAction } from "@/lib/actions/status";

const PING_INTERVAL_MS = 8000;

/**
 * While the rider is online, periodically records GPS position. Uses
 * setInterval + getCurrentPosition rather than watchPosition, since
 * watchPosition fires far more often than the backend needs and would
 * burn battery / generate excessive rider_locations rows at this MVP's
 * scale — see the architecture doc's note that this should move to
 * Realtime presence/broadcast once volume justifies it.
 */
export function LocationTracker({ enabled }: { enabled: boolean }) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !navigator.geolocation) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const ping = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          recordLocationAction(position.coords.latitude, position.coords.longitude).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
      );
    };

    ping();
    intervalRef.current = setInterval(ping, PING_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled]);

  return null;
}
