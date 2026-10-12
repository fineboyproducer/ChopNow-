/**
 * Rider matching score — per "ChopNow — Operations & Dispatch
 * Architecture," Section 1.2. This is the exact function that should
 * also run inside the automatic dispatch process (a future Supabase
 * Edge Function, see Section 1.3 of the architecture doc) so the score
 * shown to a dispatcher in the Ops Center UI is provably the same
 * calculation making the real assignment decision, not a
 * reimplementation that could quietly drift out of sync.
 */
export interface RiderScoreInput {
  distanceToRestaurantKm: number;
  online: boolean;
  status: "idle" | "assigned" | "enroute_restaurant" | "picked_up" | "delivering";
  /** 0-5. */
  rating: number;
  /** 0-100, rolling 30-day. */
  acceptanceRate: number;
}

export interface RiderScoreBreakdown {
  total: number;
  distanceScore: number;
  availabilityScore: number;
  ratingScore: number;
  workloadScore: number;
  acceptanceScore: number;
}

const RIDER_WEIGHTS = {
  distance: 0.3,
  availability: 0.2,
  rating: 0.15,
  workload: 0.15,
  acceptance: 0.2,
} as const;

export function scoreRider(r: RiderScoreInput): RiderScoreBreakdown {
  const distanceScore = Math.max(0, 100 - r.distanceToRestaurantKm * 18);
  const availabilityScore = !r.online ? 0 : r.status === "idle" ? 100 : 30;
  const ratingScore = (r.rating / 5) * 100;
  const workloadScore = r.status === "idle" ? 100 : 50;
  const acceptanceScore = r.acceptanceRate;

  const total =
    distanceScore * RIDER_WEIGHTS.distance +
    availabilityScore * RIDER_WEIGHTS.availability +
    ratingScore * RIDER_WEIGHTS.rating +
    workloadScore * RIDER_WEIGHTS.workload +
    acceptanceScore * RIDER_WEIGHTS.acceptance;

  return {
    total: Math.round(total),
    distanceScore: Math.round(distanceScore),
    availabilityScore: Math.round(availabilityScore),
    ratingScore: Math.round(ratingScore),
    workloadScore: Math.round(workloadScore),
    acceptanceScore: Math.round(acceptanceScore),
  };
}

export { RIDER_WEIGHTS };
