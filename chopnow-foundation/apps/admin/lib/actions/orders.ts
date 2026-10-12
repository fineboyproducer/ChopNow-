"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  createSupabaseServerClient,
  getAuthenticatedUser,
  requireRole,
  toAppError,
  AppError,
  createLogger,
} from "@chopnow/lib";
import type { ApiResponse, OrderStatus } from "@chopnow/types";

const log = createLogger("admin-order-actions");

// Mirrors the pipeline order from PRD Section 8. Manual "advance" always
// moves exactly one step forward — admin can't skip stages, since each
// stage transition is what the customer-facing tracker and
// order_status_history rely on to tell an honest story of what happened.
const PIPELINE_ORDER: OrderStatus[] = [
  "new",
  "payment_confirmed",
  "restaurant_notified",
  "restaurant_accepted",
  "preparing",
  "ready_for_pickup",
  "rider_assigned",
  "rider_enroute_restaurant",
  "picked_up",
  "heading_to_customer",
  "delivered",
  "completed",
];

async function getClientAndStaff() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const user = await getAuthenticatedUser(supabase);
  const authed = requireRole(user, "admin", "dispatcher");
  return { supabase, authed };
}

export async function advanceOrderStatusAction(orderId: string): Promise<ApiResponse<{ newStatus: OrderStatus }>> {
  try {
    const { supabase } = await getClientAndStaff();

    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, status")
      .eq("id", orderId)
      .single();

    if (fetchError || !order) throw AppError.notFound("Order not found.");

    const currentIndex = PIPELINE_ORDER.indexOf(order.status as OrderStatus);
    if (currentIndex === -1 || currentIndex === PIPELINE_ORDER.length - 1) {
      throw AppError.conflict("This order is already at its final stage and can't be advanced further.");
    }

    const nextStatus = PIPELINE_ORDER[currentIndex + 1]!;
    const { error: updateError } = await supabase.from("orders").update({ status: nextStatus }).eq("id", orderId);
    if (updateError) throw toAppError(updateError);

    revalidatePath("/orders");
    revalidatePath("/dashboard");
    return { success: true, data: { newStatus: nextStatus } };
  } catch (err) {
    const appError = toAppError(err);
    log.error("advanceOrderStatusAction failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }
}

export async function cancelOrderAction(orderId: string, reason: string): Promise<ApiResponse<null>> {
  try {
    const { supabase } = await getClientAndStaff();

    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, status")
      .eq("id", orderId)
      .single();

    if (fetchError || !order) throw AppError.notFound("Order not found.");

    // Per PRD Section 7.4: customer/support self-service cancellation is
    // blocked once picked_up, but admin/dispatcher retain override
    // authority "at any stage in exceptional circumstances." This action
    // IS that override — it intentionally does not re-check the
    // customer-facing cancellable-stage restriction, since that
    // restriction lives in the RLS policy governing customer-initiated
    // updates (0004_orders.sql, orders_update_own_cancel), not here.
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: "cancelled", cancelled_reason: reason || "Cancelled by admin" })
      .eq("id", orderId);

    if (updateError) throw toAppError(updateError);

    revalidatePath("/orders");
    revalidatePath("/dashboard");
    return { success: true, data: null };
  } catch (err) {
    const appError = toAppError(err);
    log.error("cancelOrderAction failed", appError);
    return { success: false, error: { code: appError.code, message: appError.message } };
  }
}
