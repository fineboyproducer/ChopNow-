/**
 * Full order lifecycle, matching the pipeline visualized in the Ops
 * & Dispatch Center. Kept as one enum (rather than separate customer-
 * facing / internal statuses) so there is exactly one source of truth
 * for "what stage is this order in."
 */
export type OrderStatus =
  | "new"
  | "payment_confirmed"
  | "restaurant_notified"
  | "restaurant_accepted"
  | "preparing"
  | "ready_for_pickup"
  | "rider_assigned"
  | "rider_enroute_restaurant"
  | "picked_up"
  | "heading_to_customer"
  | "delivered"
  | "completed"
  | "cancelled"
  | "refunded";

export const ORDER_STATUSES: readonly OrderStatus[] = [
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
  "cancelled",
  "refunded",
] as const;

/** Statuses that represent an order still actively in flight. */
export const ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = [
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
];

export type PaymentMethod = "paystack" | "flutterwave" | "cash";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string | null;
  nameAtPurchase: string;
  basePriceAtPurchase: number;
  markupApplied: number;
  priceAtPurchase: number;
  quantity: number;
  specialInstructions: string | null;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  restaurantId: string;
  riderId: string | null;
  status: OrderStatus;
  deliveryAddressId: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  deliveryPhone: string;
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentReference: string | null;
  paymentStatus: PaymentStatus;
  estimatedDeliveryMinutes: number | null;
  placedAt: string;
  deliveredAt: string | null;
  cancelledReason: string | null;
  createdAt: string;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}
