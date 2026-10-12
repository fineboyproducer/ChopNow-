/**
 * Restaurant matching score — per "ChopNow — Operations & Dispatch
 * Architecture," Section 1.1. Currently only used to power the "best
 * match" ranking shown in the Dispatch dashboard (the customer picks
 * the restaurant directly in the current ordering flow), but becomes
 * load-bearing for actual restaurant selection the moment ChopNow adds
 * "order this dish, we'll pick the best restaurant" as a feature — the
 * formula is written now so that future feature is additive, not a
 * rewrite.
 */
export interface RestaurantScoreInput {
  /** Haversine distance from the customer, in km. */
  distanceKm: number;
  /** Rolling 7-day average preparation time, in minutes. */
  avgPrepMinutes: number;
  /** Orders currently in kitchen/ready stages for this restaurant. */
  currentOrderCount: number;
  status: "open" | "busy" | "offline";
  /** 0-5. */
  rating: number;
}

export interface RestaurantScoreBreakdown {
  total: number;
  distanceScore: number;
  prepScore: number;
  workloadScore: number;
  availabilityScore: number;
  ratingScore: number;
}

const RESTAURANT_WEIGHTS = {
  distance: 0.25,
  prep: 0.2,
  workload: 0.2,
  availability: 0.2,
  rating: 0.15,
} as const;

export function scoreRestaurant(r: RestaurantScoreInput): RestaurantScoreBreakdown {
  const distanceScore = Math.max(0, 100 - r.distanceKm * 20); // 0km=100, 5km=0
  const prepScore = Math.max(0, 100 - r.avgPrepMinutes * 3); // 0min=100, ~33min=0
  const workloadScore = Math.max(0, 100 - r.currentOrderCount * 12); // fewer active orders = higher score
  const availabilityScore = r.status === "open" ? 100 : r.status === "busy" ? 40 : 0;
  const ratingScore = (r.rating / 5) * 100;

  const total =
    distanceScore * RESTAURANT_WEIGHTS.distance +
    prepScore * RESTAURANT_WEIGHTS.prep +
    workloadScore * RESTAURANT_WEIGHTS.workload +
    availabilityScore * RESTAURANT_WEIGHTS.availability +
    ratingScore * RESTAURANT_WEIGHTS.rating;

  return {
    total: Math.round(total),
    distanceScore: Math.round(distanceScore),
    prepScore: Math.round(prepScore),
    workloadScore: Math.round(workloadScore),
    availabilityScore: Math.round(availabilityScore),
    ratingScore: Math.round(ratingScore),
  };
}

export { RESTAURANT_WEIGHTS };
