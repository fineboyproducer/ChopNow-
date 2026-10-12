import { createLogger, formatNaira, createSupabaseServiceRoleClient } from "@chopnow/lib";

const log = createLogger("email-confirmation");

export interface SendOrderConfirmationInput {
  orderId: string;
  orderNumber: string;
  restaurantName: string;
  total: number;
  /** Provide either directly (cash-on-delivery path already has the user object) or via customerId (webhook path, which only has IDs). */
  customerEmail?: string | null;
  customerId?: string;
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * EMAIL CONFIRMATION ARCHITECTURE
 * ─────────────────────────────────────────────────────────────────────
 * This is a real, working implementation of the templating and send
 * pipeline, with exactly one thing swapped out: the actual outbound
 * email provider call, since sending real email requires a provider
 * account (Resend, Postmark, SES, etc.) and API key this environment
 * doesn't have. Everything else — resolving the customer's email,
 * building the HTML/text content, logging, and error handling — is
 * real and unit-testable independent of which provider ends up wired
 * into `deliverEmail` below.
 *
 * TO GO LIVE:
 *   1. Choose a provider (Resend is the simplest fit for a Next.js app:
 *      npm install resend, add RESEND_API_KEY to .env).
 *   2. Replace the body of `deliverEmail` with the provider's send call,
 *      e.g.:
 *        const resend = new Resend(process.env.RESEND_API_KEY);
 *        await resend.emails.send({ from, to, subject, html, text });
 *   3. No other function in this file needs to change — callers
 *      (createOrderAction, the Paystack webhook) already call
 *      `sendOrderConfirmationEmail` and don't know or care which
 *      provider is behind it.
 * ─────────────────────────────────────────────────────────────────────
 */
export async function sendOrderConfirmationEmail(input: SendOrderConfirmationInput): Promise<void> {
  const email = await resolveCustomerEmail(input);
  if (!email) {
    log.warn("No email on file for customer — skipping confirmation email", { orderId: input.orderId });
    return;
  }

  const { subject, html, text } = buildOrderConfirmationTemplate(input);

  await deliverEmail({ to: email, subject, html, text });

  log.info("Order confirmation email sent", { orderId: input.orderId, to: maskEmail(email) });
}

async function resolveCustomerEmail(input: SendOrderConfirmationInput): Promise<string | null> {
  if (input.customerEmail) return input.customerEmail;
  if (!input.customerId) return null;

  // profiles has no email column (Supabase keeps email on auth.users);
  // resolving it requires the Admin API, which only the service-role
  // client can call.
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.auth.admin.getUserById(input.customerId);
  if (error || !data?.user?.email) return null;
  return data.user.email;
}

function buildOrderConfirmationTemplate(input: SendOrderConfirmationInput): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Your ChopNow order ${input.orderNumber} is confirmed`;

  const text = [
    `Your order is confirmed!`,
    ``,
    `Order number: ${input.orderNumber}`,
    `Restaurant: ${input.restaurantName}`,
    `Total: ${formatNaira(input.total)}`,
    ``,
    `We'll notify you as your order moves through preparation and delivery.`,
    ``,
    `— ChopNow`,
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1F2937;">
      <div style="background: #FF6B00; padding: 24px; border-radius: 16px 16px 0 0; text-align: center;">
        <span style="color: white; font-size: 22px; font-weight: 800;">ChopNow</span>
      </div>
      <div style="border: 1px solid #EEEEEC; border-top: none; border-radius: 0 0 16px 16px; padding: 24px;">
        <h1 style="font-size: 18px; margin: 0 0 12px;">Your order is confirmed!</h1>
        <p style="font-size: 14px; color: #6B7280; margin: 0 0 20px;">
          Thanks for ordering from ChopNow. Here's a summary of your order.
        </p>
        <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6B7280;">Order number</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 700;">${input.orderNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6B7280;">Restaurant</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 700;">${escapeHtml(input.restaurantName)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6B7280; border-top: 1px dashed #EEEEEC;">Total</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 800; color: #FF6B00; border-top: 1px dashed #EEEEEC;">
              ${formatNaira(input.total)}
            </td>
          </tr>
        </table>
        <p style="font-size: 12.5px; color: #9CA3AF; margin-top: 20px;">
          We'll notify you as your order moves through preparation and delivery. You can track it
          live any time from your ChopNow account.
        </p>
      </div>
    </div>
  `.trim();

  return { subject, html, text };
}

/**
 * The actual outbound send call. Swap this implementation for a real
 * provider per the instructions above — every other function in this
 * file is provider-agnostic and won't need to change.
 */
async function deliverEmail(message: { to: string; subject: string; html: string; text: string }): Promise<void> {
  const apiKey = process.env.EMAIL_PROVIDER_API_KEY;

  if (!apiKey) {
    // No provider configured — log what would have been sent instead of
    // failing the order flow. Order creation and payment confirmation
    // must never fail because of an email problem; email is a
    // best-effort notification, not a transactional requirement (see
    // the `.catch()` at every call site of sendOrderConfirmationEmail).
    log.info("EMAIL_PROVIDER_API_KEY not set — logging email instead of sending", {
      to: maskEmail(message.to),
      subject: message.subject,
    });
    return;
  }

  // Placeholder for the real provider call — see the module doc comment
  // above for the Resend example. Left unimplemented deliberately rather
  // than guessing at credentials this environment doesn't have.
  throw new Error(
    "EMAIL_PROVIDER_API_KEY is set but no provider integration is implemented yet. " +
      "Implement the deliverEmail() function body in lib/email/send-order-confirmation.ts.",
  );
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "***";
  return `${user.slice(0, 2)}***@${domain}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
