"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, getAuthenticatedUser, requireRole, toAppError, createLogger } from "@chopnow/lib";
import type { ApiResponse } from "@chopnow/types";

const log = createLogger("rider-status-actions");

export async function setOnlineStatusAction(isOnline: boolean): Promise<ApiResponse<null>> {
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const user = await getAuthenticatedUser(supabase);
    const authed = requireRole(user, "rider");

    const { error } = await supabase.from("riders").update({ is_online: isOnline }).eq("id", authed.id);
    if (error) throw toAppError(error);

    revalidatePath("/deliveries");
    return { success: true, data: null };
  } catch (err) {
    const appError = toAppError(err);
    log.error("setOnlineStatusAction failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }
}

/**
 * Records a GPS ping into rider_locations and mirrors it onto
 * riders.current_lat/lng for quick lookups. Called periodically by the
 * rider's device while online — see components/location-tracker.tsx.
 */
export async function recordLocationAction(lat: number, lng: number): Promise<ApiResponse<null>> {
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const user = await getAuthenticatedUser(supabase);
    const authed = requireRole(user, "rider");

    const [{ error: locationError }, { error: riderError }] = await Promise.all([
      supabase.from("rider_locations").insert({ rider_id: authed.id, lat, lng }),
      supabase.from("riders").update({ current_lat: lat, current_lng: lng }).eq("id", authed.id),
    ]);

    if (locationError) throw toAppError(locationError);
    if (riderError) throw toAppError(riderError);

    return { success: true, data: null };
  } catch (err) {
    const appError = toAppError(err);
    log.error("recordLocationAction failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }
}
