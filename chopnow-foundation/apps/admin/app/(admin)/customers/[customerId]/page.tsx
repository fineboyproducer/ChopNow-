import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card } from "@chopnow/ui";
import { createSupabaseServerClient, formatNaira, formatDate, formatDateTime } from "@chopnow/lib";
import type { Database } from "@chopnow/lib/supabase/database.generated";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

export async function generateMetadata({
  params,
}: {
  // Next.js 15 passes dynamic route params as a Promise.
  params: Promise<{ customerId: string }>;
}): Promise<Metadata> {
  const { customerId } = await params;
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const { data } = await supabase.from("profiles").select("full_name").eq("id", customerId).single();
  return { title: data?.full_name ?? "Customer" };
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const { data: customer, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", customerId)
    .eq("role", "customer")
    .single();

  if (error || !customer) notFound();

  const { data: orderRows } = await supabase
    .from("orders")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  const orders = (orderRows ?? []) as OrderRow[];
  const totalSpent = orders
    .filter((o) => o.status === "completed" || o.status === "delivered")
    .reduce((sum, o) => sum + o.total, 0);

  const { data: addressRows } = await supabase.from("addresses").select("*").eq("user_id", customerId);

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
      <Link href="/customers" className="flex items-center gap-1.5 text-[13px] font-bold text-muted-foreground">
        <ChevronLeft size={16} /> Back to customers
      </Link>

      <div>
        <h1 className="text-lg font-extrabold text-foreground">{customer.full_name ?? "Unnamed customer"}</h1>
        <p className="text-[12px] text-muted-foreground">
          {customer.phone ?? "No phone on file"} · Joined {formatDate(customer.created_at)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center sm:p-4">
          <p className="break-words text-base font-black text-foreground sm:text-lg">{orders.length}</p>
          <p className="text-[11px] text-muted-foreground">Total orders</p>
        </Card>
        <Card className="p-3 text-center sm:p-4">
          <p className="break-words text-base font-black text-foreground sm:text-lg">{formatNaira(totalSpent)}</p>
          <p className="text-[11px] text-muted-foreground">Lifetime spend</p>
        </Card>
        <Card className="p-3 text-center sm:p-4">
          <p className="break-words text-base font-black text-foreground sm:text-lg">{addressRows?.length ?? 0}</p>
          <p className="text-[11px] text-muted-foreground">Saved addresses</p>
        </Card>
      </div>

      <Card className="p-4">
        <p className="mb-3 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Order history</p>
        {orders.length === 0 ? (
          <p className="py-6 text-center text-[12.5px] text-muted-foreground">No orders yet.</p>
        ) : (
          <div className="space-y-2">
            {orders.map((order) => (
              <div key={order.id} className="flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-muted">
                <div>
                  <p className="text-[12.5px] font-bold text-foreground">{order.order_number}</p>
                  <p className="text-[11px] text-muted-foreground">{formatDateTime(order.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[12.5px] font-bold text-foreground">{formatNaira(order.total)}</p>
                  <p className="text-[10.5px] text-muted-foreground">{order.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
