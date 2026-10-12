import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { createSupabaseServerClient, getAuthenticatedUser, withApiHandler } from "@chopnow/lib";
import { AppError } from "@chopnow/lib";

/**
 * Lightweight polling endpoint used only by the /checkout/confirming
 * page while it waits for the Paystack webhook to land (see PRD Section
 * 7.8 — the webhook is the sole source of truth for payment
 * confirmation; this route just lets the client observe that state
 * without needing a realtime subscription for what is normally a
 * few-second wait).
 */
export const GET = withApiHandler(async (request: NextRequest) => {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId");
  if (!orderId) throw AppError.validation("Missing orderId query parameter.");

  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const user = await getAuthenticatedUser(supabase);
  if (!user) throw AppError.unauthenticated();

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, order_number, status, payment_status")
    .eq("id", orderId)
    .eq("customer_id", user.id)
    .single();

  if (error || !order) throw AppError.notFound("Order not found.");

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    status: order.status,
    paymentStatus: order.payment_status,
  };
});
