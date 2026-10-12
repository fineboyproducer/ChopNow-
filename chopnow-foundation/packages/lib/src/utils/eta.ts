import { haversineDistanceKm, type LatLng } from "./distance";

/**
 * Rough average speed for a motorbike rider navigating Ekpoma's roads,
 * accounting for stops and traffic — not highway speed. Tune this per
 * zone/time-of-day once real delivery data exists; see the "Demand
 * Forecasting" / dynamic-ETA placeholders in the Ops Center analytics
 * view for where a data-driven version of this would plug in.
 */
const AVG_RIDER_SPEED_KMH = 22;

/** Fixed buffer for the rider to locate the restaurant/customer and hand off the order. */
const HANDOFF_BUFFER_MINUTES = 4;

export interface EtaInput {
  restaurantLocation: LatLng;
  customerLocation: LatLng;
  /** Restaurant's average food preparation time, in minutes. */
  avgPrepMinutes: number;
  /**
   * Straight-line distance is what we have without a routing API; this
   * multiplier approximates real road distance (which is always >= straight
   * line). 1.4 is a reasonable in-city default — replace with the Mapbox/
   * Google Directions API distance once that integration exists (see the
   * architecture docs' LiveMap integration notes).
   */
  roadDistanceMultiplier?: number;
}

export interface EtaResult {
  distanceKm: number;
  travelMinutes: number;
  totalMinutes: number;
}

/**
 * Estimates total delivery time: prep time (parallelizable with rider
 * travel to the restaurant, so we don't just add everything serially —
 * the rider is expected to arrive around when food is ready) plus travel
 * time from restaurant to customer, plus a fixed handoff buffer.
 */
export function estimateEtaMinutes({
  restaurantLocation,
  customerLocation,
  avgPrepMinutes,
  roadDistanceMultiplier = 1.4,
}: EtaInput): EtaResult {
  const straightLineKm = haversineDistanceKm(restaurantLocation, customerLocation);
  const distanceKm = straightLineKm * roadDistanceMultiplier;

  const travelMinutes = (distanceKm / AVG_RIDER_SPEED_KMH) * 60;

  // Prep and the rider's trip to the restaurant happen concurrently, so
  // total time is roughly max(prep, rider-arrival) + restaurant→customer
  // travel. We simplify rider-arrival-at-restaurant as a fixed fraction
  // of total travel time for this estimate.
  const riderToRestaurantMinutes = travelMinutes * 0.35;
  const restaurantToCustomerMinutes = travelMinutes * 0.65;
  const kitchenPhaseMinutes = Math.max(avgPrepMinutes, riderToRestaurantMinutes);

  const totalMinutes = Math.ceil(
    kitchenPhaseMinutes + restaurantToCustomerMinutes + HANDOFF_BUFFER_MINUTES,
  );

  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    travelMinutes: Math.round(travelMinutes),
    totalMinutes,
  };
}

/** Formats an ETA in minutes as a range, e.g. "24–34 min", matching how it's shown in the customer app. */
export function formatEtaRange(totalMinutes: number, spreadMinutes = 10): string {
  return `${totalMinutes}–${totalMinutes + spreadMinutes} min`;
}
