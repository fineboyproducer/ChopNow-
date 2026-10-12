"use server";

import { cookies } from "next/headers";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
  getAuthenticatedUser,
  requireRole,
  applyMarkup,
  getGlobalMarkupPercent,
  AppError,
  toAppError,
  createLogger,
  phoneSchema,
} from "@chopnow/lib";
import type { ApiResponse } from "@chopnow/types";
import type { Database } from "@chopnow/lib/supabase/database.generated";
import { sendOrderConfirmationEmail } from "@/lib/email/send-order-confirmation";
import { initializePaystackTransaction } from "@/lib/payments/paystack";

const log = createLogger("web-order-actions");

type MenuItemRow = Database["public"]["Tables"]["menu_items"]["Row"];
type RestaurantRow = Database["public"]["Tables"]["restaurants"]["Row"];

export interface CreateOrderLineInput {
  menuItemId: string;
  quantity: number;
  specialInstructions?: string;
}

export interface CreateOrderInput {
  restaurantId: string;
  lines: CreateOrderLineInput[];
  deliveryAddressId?: string;
  /** Used only when the customer chose "use current location" instead of a saved address. */
  manualAddress?: { fullAddress: string; lat: number; lng: number };
  deliveryPhone: string;
  paymentMethod: "paystack" | "flutterwave" | "cash";
}

export interface CreateOrderResult {
  orderId: string;
  orderNumber: string;
  total: number;
  paymentMethod: "paystack" | "flutterwave" | "cash";
  /** Present only for paystack/flutterwave — where the browser should redirect to pay. */
  paymentCheckoutUrl?: string;
}

/**
 * Creates an order end-to-end:
 *   1. Re-fetches the restaurant and every menu item from the database
 *      (never trusts prices or availability sent from the client).
 *   2. Rejects the whole order if the restaurant isn't open, or if any
 *      line item is unavailable or belongs to a different restaurant
 *      (guards against a stale/tampered cart — see PRD Section 10,
 *      "Menu Changed During Checkout").
 *   3. Computes subtotal/delivery fee/service fee/total from scratch,
 *      snapshotting base price + markup + final price onto each
 *      order_item, per PRD Section 7.1.
 *   4. Inserts the order via the service-role client — orders has no
 *      customer-facing INSERT policy (see 0004_orders.sql) specifically
 *      so this server action is the only path an order can be created
 *      through, guaranteeing FR-CHECK-02 (checkout must reflect true,
 *      server-computed pricing) can't be bypassed by a direct client call.
 *   5. For card/transfer payment methods, initializes a Paystack
 *      transaction and returns the checkout URL — the order is created
 *      in `new` status with payment_status `pending` and is only moved
 *      to `payment_confirmed` by the webhook (see
 *      app/api/webhooks/paystack/route.ts), never here (PRD Section 7.8).
 *   6. For cash on delivery, marks payment_status `pending` (collected by
 *      the rider at delivery) and moves status straight to
 *      `restaurant_notified` — no payment gate to wait on.
 */
export async function createOrderAction(input: CreateOrderInput): Promise<ApiResponse<CreateOrderResult>> {
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const user = await getAuthenticatedUser(supabase);
    const authed = requireRole(user, "customer");

    if (input.lines.length === 0) {
      throw AppError.validation("Your cart is empty.");
    }

    const phoneCheck = phoneSchema.safeParse(input.deliveryPhone);
    if (!phoneCheck.success) {
      throw AppError.validation("Enter a valid Nigerian phone number for delivery.", {
        deliveryPhone: "Enter a valid Nigerian phone number, e.g. 08031234567",
      });
    }

    if (!input.deliveryAddressId && !input.manualAddress) {
      throw AppError.validation("Select a delivery address or use your current location.");
    }

    // Service-role client: this is the one place in the codebase allowed
    // to insert directly into `orders`, since the table's RLS policies
    // grant no customer-facing INSERT (see 0004_orders.sql). Every value
    // written below is derived from server-side lookups, never trusted
    // from `input` where it would matter financially.
    const serviceClient = createSupabaseServiceRoleClient();

    const { data: restaurantRow, error: restaurantError } = await serviceClient
      .from("restaurants")
      .select("*")
      .eq("id", input.restaurantId)
      .single();

    if (restaurantError || !restaurantRow) {
      throw AppError.notFound("This restaurant could not be found.");
    }
    const restaurant = restaurantRow as RestaurantRow;

    if (restaurant.status === "offline") {
      throw AppError.conflict(
        `${restaurant.name} isn't accepting orders right now. Please choose another restaurant.`,
      );
    }

    const menuItemIds = input.lines.map((l) => l.menuItemId);
    const { data: menuItemRows, error: menuItemsError } = await serviceClient
      .from("menu_items")
      .select("*")
      .in("id", menuItemIds);

    if (menuItemsError || !menuItemRows) {
      throw AppError.internal("Could not verify menu items.");
    }
    const menuItems = menuItemRows as MenuItemRow[];

    // Guard against a stale cart: every requested item must exist,
    // belong to this restaurant, and currently be available.
    for (const line of input.lines) {
      const item = menuItems.find((m) => m.id === line.menuItemId);
      if (!item) {
        throw AppError.conflict("One of the items in your cart is no longer on the menu. Please review your cart.");
      }
      if (item.restaurant_id !== input.restaurantId) {
        throw AppError.validation("Your cart contains items from more than one restaurant.");
      }
      if (!item.is_available) {
        throw AppError.conflict(`"${item.name}" is currently sold out. Please remove it from your cart.`);
      }
      if (line.quantity < 1 || !Number.isInteger(line.quantity)) {
        throw AppError.validation("Item quantities must be whole numbers greater than zero.");
      }
    }

    const globalMarkupPercent = await getGlobalMarkupPercent(serviceClient);

    let subtotal = 0;
    const orderItemsToInsert = input.lines.map((line) => {
      const item = menuItems.find((m) => m.id === line.menuItemId)!;
      const priceAtPurchase = applyMarkup({
        basePrice: item.base_price,
        markupPercentOverride: restaurant.markup_percent_override,
        globalMarkupPercent,
      });
      const markupApplied = priceAtPurchase - item.base_price;
      subtotal += priceAtPurchase * line.quantity;

      return {
        menu_item_id: item.id,
        name_at_purchase: item.name,
        base_price_at_purchase: item.base_price,
        markup_applied: markupApplied,
        price_at_purchase: priceAtPurchase,
        quantity: line.quantity,
        special_instructions: line.specialInstructions?.trim() || null,
      };
    });

    const deliveryFee = restaurant.base_delivery_fee;
    const serviceFee = 150;
    const total = subtotal + deliveryFee + serviceFee;

    // Resolve delivery address: either a saved address (verified to
    // belong to this customer) or a manually-supplied current-location
    // address (PRD Section 10, "GPS Unavailable" fallback path).
    let deliveryFullAddress: string;
    let deliveryLat: number | null = null;
    let deliveryLng: number | null = null;
    let deliveryAddressId: string | null = null;

    if (input.deliveryAddressId) {
      const { data: addressRow, error: addressError } = await serviceClient
        .from("addresses")
        .select("*")
        .eq("id", input.deliveryAddressId)
        .eq("user_id", authed.id)
        .single();
      if (addressError || !addressRow) {
        throw AppError.validation("The selected address could not be found.");
      }
      deliveryFullAddress = addressRow.full_address;
      deliveryLat = Number(addressRow.lat);
      deliveryLng = Number(addressRow.lng);
      deliveryAddressId = addressRow.id;
    } else {
      deliveryFullAddress = input.manualAddress!.fullAddress;
      deliveryLat = input.manualAddress!.lat;
      deliveryLng = input.manualAddress!.lng;
    }

    const initialStatus = input.paymentMethod === "cash" ? "restaurant_notified" : "new";

    // Reserve the payment reference up front, before calling Paystack,
    // so the order row always has its reference from the moment it's
    // created — the webhook can then always find the order by
    // reference regardless of how quickly Paystack calls back. (An
    // earlier version of this function called Paystack first and
    // patched the reference on afterward; reserving it up front instead
    // removes that ordering dependency entirely rather than relying on
    // the webhook being slow enough not to notice.)
    const paymentReference =
      input.paymentMethod === "paystack" ? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}` : null;

    const { data: orderRow, error: orderError } = await serviceClient
      .from("orders")
      .insert({
        customer_id: authed.id,
        restaurant_id: restaurant.id,
        status: initialStatus,
        delivery_address_id: deliveryAddressId,
        delivery_lat: deliveryLat,
        delivery_lng: deliveryLng,
        delivery_full_address: deliveryFullAddress,
        delivery_phone: phoneCheck.data,
        subtotal,
        delivery_fee: deliveryFee,
        service_fee: serviceFee,
        total,
        payment_method: input.paymentMethod,
        payment_reference: paymentReference,
        payment_status: "pending",
      })
      .select("*")
      .single();

    if (orderError || !orderRow) {
      log.error("Order insert failed", toAppError(orderError));
      throw AppError.internal("Could not create your order. Please try again.");
    }

    const { error: itemsError } = await serviceClient
      .from("order_items")
      .insert(orderItemsToInsert.map((oi) => ({ ...oi, order_id: orderRow.id })));

    if (itemsError) {
      // Order shell exists but items failed — roll back by cancelling
      // rather than leaving an empty, uncancellable order behind.
      await serviceClient
        .from("orders")
        .update({ status: "cancelled", cancelled_reason: "order_items_insert_failed" })
        .eq("id", orderRow.id);
      log.error("Order items insert failed, order rolled back", toAppError(itemsError), { orderId: orderRow.id });
      throw AppError.internal("Could not create your order. Please try again.");
    }

    log.info("Order created", {
      orderId: orderRow.id,
      orderNumber: orderRow.order_number,
      total,
      paymentMethod: input.paymentMethod,
    });

    if (input.paymentMethod === "cash") {
      // No payment gateway involved — proceed straight to restaurant
      // notification per PRD Section 7.8. Confirmation email fires
      // immediately since there's no payment webhook to wait for.
      await sendOrderConfirmationEmail({
        orderId: orderRow.id,
        orderNumber: orderRow.order_number,
        customerEmail: authed.email,
        restaurantName: restaurant.name,
        total,
      }).catch((err) => log.error("Confirmation email failed (non-fatal)", err, { orderId: orderRow.id }));

      return {
        success: true,
        data: { orderId: orderRow.id, orderNumber: orderRow.order_number, total, paymentMethod: "cash" },
      };
    }

    if (input.paymentMethod === "paystack") {
      try {
        const init = await initializePaystackTransaction({
          email: authed.email ?? `${authed.id}@chopnow-guest.local`,
          amountKobo: total * 100,
          orderId: orderRow.id,
          orderNumber: orderRow.order_number,
          reference: paymentReference!,
        });

        return {
          success: true,
          data: {
            orderId: orderRow.id,
            orderNumber: orderRow.order_number,
            total,
            paymentMethod: "paystack",
            paymentCheckoutUrl: init.authorizationUrl,
          },
        };
      } catch (paystackErr) {
        // Paystack initialization failed after the order row was already
        // created. Cancel it immediately rather than leaving an orphaned
        // "new" order for the Section 7.7 expiration timer to clean up
        // later — the customer is right here, waiting for an answer.
        await serviceClient
          .from("orders")
          .update({ status: "cancelled", cancelled_reason: "payment_initialization_failed" })
          .eq("id", orderRow.id);
        throw paystackErr;
      }
    }

    // Flutterwave: integration seam defined but not implemented in this
    // sprint (Paystack is the sprint's required integration per the
    // brief). Rejecting explicitly rather than silently mis-handling it.
    throw AppError.validation("Flutterwave is not yet available. Please choose Paystack or cash on delivery.");
  } catch (err) {
    const appError = toAppError(err);
    log.error("createOrderAction failed", appError);
    return {
      success: false,
      error: {
        code: appError.code,
        message: appError.message,
        ...(appError.fieldErrors ? { fieldErrors: appError.fieldErrors } : {}),
      },
    };
  }
}
