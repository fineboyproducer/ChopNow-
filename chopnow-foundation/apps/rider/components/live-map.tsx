"use client";

import { Store, MapPin, Bike } from "lucide-react";
import { haversineDistanceKm, formatDistance } from "@chopnow/lib";

/**
 * MAP INTEGRATION SEAM: renders a stylized, dependency-free route so
 * the delivery screen feels alive without requiring a Mapbox/Google
 * Maps API key in this environment. To integrate a real map, swap the
 * <svg> below for mapbox-gl or @vis.gl/react-google-maps, centered
 * between origin/dest, with a live marker fed by the same geolocation
 * watch in components/location-tracker.tsx. For turn-by-turn
 * navigation specifically, deep-linking to the device's own maps app
 * (see openNavigationTo below) is more reliable than building
 * turn-by-turn from scratch.
 */
export function LiveMap({
  originLat,
  originLng,
  destLat,
  destLng,
  originLabel,
  destLabel,
}: {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  originLabel: string;
  destLabel: string;
}) {
  const path = "M 30 130 C 70 100, 60 60, 110 55 C 160 50, 150 100, 190 40";
  const distanceKm = haversineDistanceKm({ lat: originLat, lng: originLng }, { lat: destLat, lng: destLng });

  return (
    <div className="relative h-40 overflow-hidden rounded-xl bg-[#EFF6FF]">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "linear-gradient(#E2ECF7 1px, transparent 1px), linear-gradient(90deg, #E2ECF7 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <svg viewBox="0 0 220 160" className="absolute inset-0 h-full w-full">
        <path d={path} fill="none" stroke="#FF6B00" strokeWidth="3" strokeDasharray="1 8" strokeLinecap="round" opacity="0.85" />
        <g transform="translate(30,130)"><circle r="7" fill="#1F2937" /></g>
        <g transform="translate(190,40)"><circle r="7" fill="#22C55E" /></g>
      </svg>
      <div className="absolute left-1/3 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary shadow-lg">
        <Bike size={15} className="text-primary-foreground" />
      </div>
      <div className="absolute right-2.5 top-2.5 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-[#1F2937]">
        {formatDistance(distanceKm)}
      </div>
      <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between">
        <span className="flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-[#1F2937]">
          <Store size={10} /> {originLabel}
        </span>
        <span className="flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-[#1F2937]">
          <MapPin size={10} /> {destLabel}
        </span>
      </div>
    </div>
  );
}

export function openNavigationTo(lat: number, lng: number) {
  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const url = isIOS
    ? `maps://maps.apple.com/?daddr=${lat},${lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  window.open(url, "_blank");
}
