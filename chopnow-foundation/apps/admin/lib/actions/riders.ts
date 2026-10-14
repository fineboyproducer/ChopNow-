"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, getAuthenticatedUser, requireRole, toAppError, AppError, createLogger } from "@chopnow/lib";
import type { ApiResponse, OrderStatus } from "@chopnow/types";

const log = createLogger("admin-rider-actions");

// Statuses an order must currently be in for a rider to be (re)assigned to
// it. Mirrors DISPATCHABLE_STATUSES in
// app/(admin)/dispatch/page.tsx — keep both lists in sync if the
// dispatch pipeline's eligible stages ever change. "rider_assigned" is
// included (not just "ready_for_pickup") because reassignRiderAction
// below calls this same function to swap an order's rider without first
// moving the order out of rider_assigned.
const RIDER_ASSIGNABLE_STATUSES: OrderStatus[] = ["ready_for_pickup", "rider_assigned"];

async function getClientAndStaff() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const user = await getAuthenticatedUser(supabase);
  const authed = requireRole(user, "admin", "dispatcher");
  return { supabase, authed };
}

export async function setRiderActiveAction(riderId: string, isActive: boolean): Promise<ApiResponse<null>> {
  try {
    const { supabase } = await getClientAndStaff();
    const { error } = await supabase.from("riders").update({ is_active: isActive }).eq("id", riderId);
    if (error) throw toAppError(error);

    revalidatePath("/riders");
    return { success: true, data: null };
  } catch (err) {
    const appError = toAppError(err);
    log.error("setRiderActiveAction failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }
}

/**
 * Manually assigns a rider to an order that is ready for pickup — the
 * dispatcher-facing override path described in the architecture doc's
 * dispatch fallback flow (Section 1.3): when the automatic ranking is
 * exhausted with no acceptance, or a dispatcher simply wants to override
 * the top-ranked suggestion, this is the one-click assignment action.
 * Records a `dispatch_attempts` row with outcome 'accepted' so manual
 * assignments show up in the same audit trail as automatic ones, and
 * advances the order to `rider_assigned`.
 */
export async function assignRiderToOrderAction(orderId: string, riderId: string): Promise<ApiResponse<null>> {
  try {
    const { supabase, authed } = await getClientAndStaff();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, status, rider_id")
      .eq("id", orderId)
      .single();

    if (orderError || !order) throw AppError.notFound("Order not found.");

    if (!RIDER_ASSIGNABLE_STATUSES.includes(order.status as OrderStatus)) {
      throw AppError.conflict(
        `This order is "${order.status}" and can no longer be assigned a rider. Only orders ready for pickup (or already assigned, for reassignment) are eligible.`,
      );
    }

    const { data: rider, error: riderError } = await supabase
      .from("riders")
      .select("id, is_online, is_active")
      .eq("id", riderId)
      .single();

    if (riderError || !rider) throw AppError.notFound("Rider not found.");
    if (!rider.is_active) throw AppError.conflict("This rider account is deactivated.");

    // Re-validate eligibility atomically at write time, not just at the
    // SELECT above: between that read and this write, another admin could
    // cancel the order, or it could auto-advance past ready_for_pickup,
    // making the status check above stale (a classic check-then-act
    // race). Scoping the UPDATE's own WHERE clause to the same eligible
    // statuses means the write itself only succeeds if the order is
    // *still* eligible the instant it runs — if a concurrent change beat
    // us to it, this matches zero rows and updatedOrder comes back null,
    // which is treated as a conflict rather than silently doing nothing.
    const { data: updatedOrder, error: updateOrderError } = await supabase
      .from("orders")
      .update({ rider_id: riderId, status: "rider_assigned" })
      .eq("id", orderId)
      .in("status", RIDER_ASSIGNABLE_STATUSES)
      .select("id")
      .maybeSingle();
    if (updateOrderError) throw toAppError(updateOrderError);
    if (!updatedOrder) {
      throw AppError.conflict(
        "This order's status changed just now and is no longer eligible for rider assignment. Please refresh and try again.",
      );
    }

    const { error: updateRiderError } = await supabase.from("riders").update({ status: "assigned" }).eq("id", riderId);
    if (updateRiderError) throw toAppError(updateRiderError);

    await supabase.from("dispatch_attempts").insert({
      order_id: orderId,
      rider_id: riderId,
      outcome: "accepted",
      responded_at: new Date().toISOString(),
      score_breakdown: { manual: true, assigned_by: authed.id },
    });

    revalidatePath("/riders");
    revalidatePath("/dispatch");
    revalidatePath("/pipeline");
    revalidatePath("/orders");
    return { success: true, data: null };
  } catch (err) {
    const appError = toAppError(err);
    log.error("assignRiderToOrderAction failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }
}

/**
 * Reassigns an order already carrying a rider to a different rider —
 * e.g. the "rider offline mid-delivery" scenario from PRD Section 9.9.
 * Releases the previous rider back to idle and logs a cancelled
 * dispatch_attempts row for them, then assigns the new rider the same
 * way assignRiderToOrderAction does.
 */
export async function reassignRiderAction(orderId: string, newRiderId: string): Promise<ApiResponse<null>> {
  try {
    const { supabase } = await getClientAndStaff();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, rider_id")
      .eq("id", orderId)
      .single();

    if (orderError || !order) throw AppError.notFound("Order not found.");

    if (order.rider_id) {
      await supabase.from("riders").update({ status: "idle" }).eq("id", order.rider_id);
      await supabase
        .from("dispatch_attempts")
        .update({ outcome: "cancelled", responded_at: new Date().toISOString() })
        .eq("order_id", orderId)
        .eq("rider_id", order.rider_id)
        .is("responded_at", null);
    }

    return assignRiderToOrderAction(orderId, newRiderId);
  } catch (err) {
    const appError = toAppError(err);
    log.error("reassignRiderAction failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }
}
