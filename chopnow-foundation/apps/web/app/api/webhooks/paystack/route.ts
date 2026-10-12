import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceRoleClient, createLogger } from "@chopnow/lib";
import { sendOrderConfirmationEmail } from "@/lib/email/send-order-confirmation";

const log = createLogger("paystack-webhook");

interface PaystackWebhookEvent {
  event: string;
  data: {
    reference: string;
    amount: number;
    status: string;
    metadata?: { order_id?: string; order_number?: string };
  };
}

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;

  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");

  // Constant-time comparison — a naive `expected === signature` string
  // compare would leak timing information an attacker could use to
  // forge a valid signature byte-by-byte.
  const expectedBuf = Buffer.from(expected, "hex");
  const signatureBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== signatureBuf.length) return false;
  return timingSafeEqual(expectedBuf, signatureBuf);
}

async function handleChargeSuccess(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  event: PaystackWebhookEvent,
) {
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("payment_reference", event.data.reference)
    .single();

  if (error || !order) {
    log.error("Webhook charge.success for unknown order reference", undefined, {
      reference: event.data.reference,
    });
    return;
  }

  // Idempotency guard: if a retried/duplicate webhook arrives for an
  // order already marked paid, do nothing further rather than
  // re-running the notification step a second time.
  if (order.payment_status === "paid") {
    log.info("Ignoring duplicate charge.success webhook (already paid)", { orderId: order.id });
    return;
  }

  // Defense in depth: confirm the charged amount matches what we
  // expected before trusting the webhook, since amount mismatches would
  // indicate a tampered or malformed request even after signature
  // verification passes.
  if (event.data.amount !== order.total * 100) {
    log.error("Webhook amount mismatch — flagging for manual review, not auto-confirming", undefined, {
      orderId: order.id,
      expectedKobo: order.total * 100,
      receivedKobo: event.data.amount,
    });
    return;
  }

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("name")
    .eq("id", order.restaurant_id)
    .single();

  await supabase
    .from("orders")
    .update({ payment_status: "paid", status: "restaurant_notified" })
    .eq("id", order.id);

  log.info("Payment confirmed via webhook", { orderId: order.id, orderNumber: order.order_number });

  // Restaurant notification (call/WhatsApp per PRD Section 9) is a
  // separate, admin-mediated workflow implemented in the Ops & Dispatch
  // Center, not this customer-facing app — this webhook's job ends at
  // moving the order to `restaurant_notified` status so that workflow
  // can pick it up.
  await sendOrderConfirmationEmail({
    orderId: order.id,
    orderNumber: order.order_number,
    customerId: order.customer_id,
    restaurantName: restaurant?.name ?? "your restaurant",
    total: order.total,
  }).catch((err) => log.error("Confirmation email failed (non-fatal)", err, { orderId: order.id }));
}

async function handleChargeFailed(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  event: PaystackWebhookEvent,
) {
  const { data: order } = await supabase
    .from("orders")
    .select("id, payment_status")
    .eq("payment_reference", event.data.reference)
    .single();

  if (!order || order.payment_status === "paid") return;

  await supabase.from("orders").update({ payment_status: "failed" }).eq("id", order.id);
  log.info("Payment failed, marked on order", { orderId: order.id });
}

/**
 * Paystack webhook — the ONLY code path in the entire system allowed to
 * transition an order from payment_status "pending" to "paid" for
 * card/transfer payments. Per PRD Section 7.8 / FR-PAY-02: a successful-
 * looking client redirect is never sufficient on its own. This handler:
 *
 *   1. Verifies the request actually came from Paystack by checking the
 *      x-paystack-signature header against an HMAC-SHA512 of the raw
 *      request body, using the webhook secret. Requests that fail this
 *      check are rejected with 401 and never touch the database.
 *   2. On a genuine "charge.success" event, looks up the order by the
 *      payment reference and moves it from `new` -> `payment_confirmed`
 *      -> `restaurant_notified` (the notification step itself is a
 *      placeholder here — see Section 9's restaurant communication
 *      workflow / the Ops Center architecture for the actual WhatsApp
 *      dispatch, which is out of scope for this sprint).
 *   3. Is idempotent: Paystack may deliver the same webhook more than
 *      once, so this checks the order's current payment_status before
 *      writing, and does nothing if it's already "paid" (see PRD
 *      Section 10, "Duplicate Payment" handling).
 *   4. On "charge.failed", marks payment_status "failed" so the
 *      customer-facing confirming page can show a retry option instead
 *      of hanging indefinitely.
 *
 * Configure this URL (https://<domain>/api/webhooks/paystack) in the
 * Paystack dashboard under Settings → API Keys & Webhooks.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-paystack-signature");
  const rawBody = await request.text();

  if (!verifySignature(rawBody, signature)) {
    log.error("Rejected webhook with invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: PaystackWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createSupabaseServiceRoleClient();

  try {
    if (event.event === "charge.success") {
      await handleChargeSuccess(supabase, event);
    } else if (event.event === "charge.failed") {
      await handleChargeFailed(supabase, event);
    } else {
      log.info("Ignoring unhandled Paystack event type", { type: event.event });
    }
  } catch (err) {
    // Paystack retries on non-2xx, so we still want to return 200 once
    // we've at least logged the failure for manual reconciliation (see
    // PRD Section 9.10) — returning 500 here would just cause Paystack
    // to hammer us with retries for an error that likely needs a human,
    // not a retry, to resolve.
    log.error("Error processing Paystack webhook (returning 200 to stop retries; needs manual review)", err, {
      reference: event?.data?.reference,
    });
  }

  return NextResponse.json({ received: true });
}
