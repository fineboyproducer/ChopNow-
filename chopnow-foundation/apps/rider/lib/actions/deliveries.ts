"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, getAuthenticatedUser, requireRole, toAppError, AppError, createLogger } from "@chopnow/lib";
import type { ApiResponse } from "@chopnow/types";
import type { Database } from "@chopnow/lib/supabase/database.generated";

// OrderStatusEnum itself isn't exported from database.generated.ts, so
// it's derived the same way every other app in this monorepo references
// it: through the orders Row type.
type OrderStatus = Database["public"]["Tables"]["orders"]["Row"]["status"];

const log = createLogger("rider-delivery-actions");

async function getClientAndRider() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const user = await getAuthenticatedUser(supabase);
  const authed = requireRole(user, "rider");
  return { supabase, authed };
}

export async function acceptDeliveryOfferAction(dispatchAttemptId: string): Promise<ApiResponse<{ orderId: string }>> {
  try {
    const { supabase, authed } = await getClientAndRider();

    const { data: attempt, error: attemptError } = await supabase
      .from("dispatch_attempts")
      .select("*")
      .eq("id", dispatchAttemptId)
      .eq("rider_id", authed.id)
      .single();

    if (attemptError || !attempt) throw AppError.notFound("This delivery offer could not be found.");
    if (attempt.outcome) throw AppError.conflict("This offer has already been responded to.");

    const { error: attemptUpdateError } = await supabase
      .from("dispatch_attempts")
      .update({ outcome: "accepted", responded_at: new Date().toISOString() })
      .eq("id", dispatchAttemptId);
    if (attemptUpdateError) throw toAppError(attemptUpdateError);

    const { error: orderError } = await supabase
      .from("orders")
      .update({ rider_id: authed.id, status: "rider_assigned" })
      .eq("id", attempt.order_id);
    if (orderError) throw toAppError(orderError);

    const { error: riderError } = await supabase.from("riders").update({ status: "assigned" }).eq("id", authed.id);
    if (riderError) throw toAppError(riderError);

    revalidatePath("/deliveries");
    return { success: true, data: { orderId: attempt.order_id } };
  } catch (err) {
    const appError = toAppError(err);
    log.error("acceptDeliveryOfferAction failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }
}

export async function rejectDeliveryOfferAction(dispatchAttemptId: string): Promise<ApiResponse<null>> {
  try {
    const { supabase, authed } = await getClientAndRider();

    const { data: attempt, error: attemptError } = await supabase
      .from("dispatch_attempts")
      .select("id, outcome")
      .eq("id", dispatchAttemptId)
      .eq("rider_id", authed.id)
      .single();

    if (attemptError || !attempt) throw AppError.notFound("This delivery offer could not be found.");
    if (attempt.outcome) throw AppError.conflict("This offer has already been responded to.");

    const { error } = await supabase
      .from("dispatch_attempts")
      .update({ outcome: "rejected", responded_at: new Date().toISOString() })
      .eq("id", dispatchAttemptId);
    if (error) throw toAppError(error);

    revalidatePath("/deliveries");
    return { success: true, data: null };
  } catch (err) {
    const appError = toAppError(err);
    log.error("rejectDeliveryOfferAction failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }
}

// Partial<Record<...>>, not Record<string, ...>: that plain-string keying
// is what let `nextStatus` widen to `string` below, which Supabase's
// typed .update({ status }) call rejects — it needs the literal
// OrderStatus union, not an arbitrary string, however well-formed.
const RIDER_PROGRESSION: Partial<Record<OrderStatus, OrderStatus>> = {
  rider_assigned: "rider_enroute_restaurant",
  rider_enroute_restaurant: "picked_up",
  picked_up: "heading_to_customer",
  heading_to_customer: "delivered",
};

const RIDER_STATUS_FOR_ORDER_STATUS: Partial<
  Record<OrderStatus, "enroute_restaurant" | "picked_up" | "delivering" | "idle">
> = {
  rider_enroute_restaurant: "enroute_restaurant",
  picked_up: "picked_up",
  heading_to_customer: "delivering",
  delivered: "idle",
};

export async function advanceDeliveryAction(orderId: string): Promise<ApiResponse<{ newStatus: string }>> {
  try {
    const { supabase, authed } = await getClientAndRider();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, status, rider_id")
      .eq("id", orderId)
      .single();

    if (orderError || !order) throw AppError.notFound("Order not found.");
    if (order.rider_id !== authed.id) throw AppError.forbidden("This delivery isn't assigned to you.");

    const nextStatus = RIDER_PROGRESSION[order.status];
    if (!nextStatus) {
      throw AppError.conflict("This order can't be advanced further from its current stage.");
    }

    const { error: updateError } = await supabase.from("orders").update({ status: nextStatus }).eq("id", orderId);
    if (updateError) throw toAppError(updateError);

    const riderStatus = RIDER_STATUS_FOR_ORDER_STATUS[nextStatus] ?? "idle";
    await supabase.from("riders").update({ status: riderStatus }).eq("id", authed.id);

    revalidatePath("/deliveries");
    return { success: true, data: { newStatus: nextStatus } };
  } catch (err) {
    const appError = toAppError(err);
    log.error("advanceDeliveryAction failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }
}
