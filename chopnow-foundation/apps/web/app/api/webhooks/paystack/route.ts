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

/**
 * Relays a webhook event this app doesn't own to another Paystack
 * webhook consumer on the same Paystack account. Paystack's classic
 * dashboard only accepts one webhook URL per environment, and this
 * account already has one in use for an unrelated WooCommerce store
 * (fineboyproducer.com) — so instead of that URL being overwritten
 * (which would silently break WooCommerce's payment confirmations),
 * ChopNow's URL is configured as the one Paystack calls, and anything
 * that isn't a ChopNow event is forwarded here, unchanged, to the
 * original destination.
 *
 * Forwards the exact raw body and the exact x-paystack-signature header
 * Paystack sent — never re-signs or re-serializes — so the receiving
 * app's own signature verification (computed against that same shared
 * account secret) still passes on its end.
 */
async function relayToOtherWebhookConsumer(rawBody: string, signature: string | null) {
  const relayUrl = process.env.PAYSTACK_WEBHOOK_RELAY_URL;
  if (!relayUrl) return;

  try {
    const response = await fetch(relayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(signature ? { "x-paystack-signature": signature } : {}),
      },
      body: rawBody,
    });
    log.info("Relayed non-ChopNow webhook event", { relayUrl, status: response.status });
  } catch (err) {
    // The relay target being unreachable is the relay target's problem to
    // notice and fix, not a reason to fail this request — Paystack only
    // needs a 200 from the URL it actually called (this one) to stop
    // retrying, and there is nothing ChopNow itself needs to do with an
    // event that was never its own.
    log.error("Failed to relay non-ChopNow webhook event (non-fatal)", err, { relayUrl });
  }
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
 *   2. Checks whether the event is actually ChopNow's: Paystack's classic
 *      dashboard allows only one webhook URL per environment, and this
 *      account's URL is also relied on by an unrelated WooCommerce store
 *      (fineboyproducer.com). Rather than overwrite that URL — which
 *      would silently break WooCommerce's payment confirmations — this
 *      URL is the one Paystack calls for the whole account, and anything
 *      without ChopNow's own metadata.order_id is forwarded unchanged to
 *      that other consumer (see relayToOtherWebhookConsumer above) and
 *      never touches ChopNow's database.
 *   3. On a genuine "charge.success" event, looks up the order by the
 *      payment reference and moves it from `new` -> `payment_confirmed`
 *      -> `restaurant_notified` (the notification step itself is a
 *      placeholder here — see Section 9's restaurant communication
 *      workflow / the Ops Center architecture for the actual WhatsApp
 *      dispatch, which is out of scope for this sprint).
 *   4. Is idempotent: Paystack may deliver the same webhook more than
 *      once, so this checks the order's current payment_status before
 *      writing, and does nothing if it's already "paid" (see PRD
 *      Section 10, "Duplicate Payment" handling).
 *   5. On "charge.failed", marks payment_status "failed" so the
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

  // ChopNow sets metadata.order_id on every transaction it initializes
  // (see lib/payments/paystack.ts) — its presence is how a ChopNow event
  // is told apart from anything else arriving at this shared account's
  // one webhook URL (see relayToOtherWebhookConsumer above).
  const isChopNowEvent = Boolean(event.data?.metadata?.order_id);

  if (!isChopNowEvent) {
    log.info("Webhook event has no ChopNow order_id metadata — relaying, not processing here", {
      type: event.event,
      reference: event.data?.reference,
    });
    await relayToOtherWebhookConsumer(rawBody, signature);
    return NextResponse.json({ received: true });
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
