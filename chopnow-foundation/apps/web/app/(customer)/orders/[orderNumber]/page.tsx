import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Check, Clock, MapPin, Phone } from "lucide-react";
import { Card, Button } from "@chopnow/ui";
import { createSupabaseServerClient, getAuthenticatedUser, formatNaira, formatDateTime } from "@chopnow/lib";
import type { Database } from "@chopnow/lib/supabase/database.generated";

export const metadata: Metadata = { title: "Order details" };

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];

const STATUS_LABELS: Record<string, string> = {
  new: "Order received",
  payment_confirmed: "Payment confirmed",
  restaurant_notified: "Sent to restaurant",
  restaurant_accepted: "Restaurant accepted",
  preparing: "Being prepared",
  ready_for_pickup: "Ready for pickup",
  rider_assigned: "Rider assigned",
  rider_enroute_restaurant: "Rider heading to restaurant",
  picked_up: "Picked up",
  heading_to_customer: "On the way to you",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  // Next.js 15 passes dynamic route params and searchParams as Promises.
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ justPlaced?: string }>;
}) {
  const [{ orderNumber }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const user = await getAuthenticatedUser(supabase);
  if (!user) notFound();

  const { data: orderRow, error } = await supabase
    .from("orders")
    .select("*")
    .eq("order_number", orderNumber)
    .eq("customer_id", user.id)
    .single();

  if (error || !orderRow) notFound();
  const order = orderRow as OrderRow;

  const { data: itemRows } = await supabase.from("order_items").select("*").eq("order_id", order.id);
  const items = (itemRows ?? []) as OrderItemRow[];

  const { data: restaurantRow } = await supabase
    .from("restaurants")
    .select("name, logo_url")
    .eq("id", order.restaurant_id)
    .single();

  const justPlaced = resolvedSearchParams.justPlaced === "1";

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 md:px-10">
      {justPlaced && (
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-success/10">
            <Check size={28} className="text-success" strokeWidth={2.2} />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">
            Order placed — thank you!
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We&apos;ve sent your order to {restaurantRow?.name ?? "the restaurant"}. You&apos;ll be
            notified as it moves through preparation and delivery.
          </p>
        </div>
      )}

      <Card className="mb-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Order {order.order_number}
            </p>
            <p className="mt-0.5 text-[15px] font-extrabold text-foreground">
              {STATUS_LABELS[order.status] ?? order.status}
            </p>
          </div>
          <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-primary">
            {order.payment_method === "cash" ? "Cash on delivery" : order.payment_status}
          </span>
        </div>
      </Card>

      <Card className="mb-4 p-4">
        <p className="mb-3 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
          Order details
        </p>
        <div className="mb-3 flex items-center gap-3">
          {restaurantRow?.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={restaurantRow.logo_url} className="h-10 w-10 rounded-xl object-cover" alt="" />
          )}
          <div>
            <p className="text-[13px] font-bold text-foreground">{restaurantRow?.name}</p>
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin size={11} /> {order.delivery_full_address}
            </p>
          </div>
        </div>
        <div className="space-y-1.5">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between text-[12.5px]">
              <span className="text-muted-foreground">
                {item.quantity}× {item.name_at_purchase}
              </span>
              <span className="font-semibold text-foreground">
                {formatNaira(item.price_at_purchase * item.quantity)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 space-y-1.5 border-t border-dashed border-border pt-2 text-[13px]">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatNaira(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Delivery fee</span>
            <span>{formatNaira(order.delivery_fee)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Service fee</span>
            <span>{formatNaira(order.service_fee)}</span>
          </div>
          <div className="flex justify-between pt-1 text-[15px] font-extrabold text-foreground">
            <span>Total</span>
            <span>{formatNaira(order.total)}</span>
          </div>
        </div>
      </Card>

      <Card className="mb-4 flex items-center gap-2.5 p-3.5">
        <Clock size={16} className="shrink-0 text-primary" />
        <p className="text-[12.5px] text-foreground/80">Placed {formatDateTime(order.placed_at)}</p>
      </Card>

      <Card className="mb-6 flex items-center gap-2.5 p-3.5">
        <Phone size={16} className="shrink-0 text-primary" />
        <p className="text-[12.5px] text-foreground/80">
          Delivering to <span className="font-bold text-foreground">{order.delivery_phone}</span>
        </p>
      </Card>

      <div className="flex gap-3">
        <Button variant="ghost" asChild className="flex-1">
          <Link href="/account/orders">View all orders</Link>
        </Button>
        <Button asChild className="flex-1">
          <Link href="/home">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
