const EARTH_RADIUS_KM = 6371;

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Great-circle distance between two points in kilometers, via the
 * haversine formula. This is what powers "nearest restaurant" sorting
 * and rider-distance scoring — an approximation good enough for
 * short in-city distances, but not a substitute for actual routing
 * distance (see note on `estimateEtaMinutes` below).
 */
export function haversineDistanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_KM * c;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Formats a distance in km as "850 m" below 1km, otherwise "2.3 km". */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
