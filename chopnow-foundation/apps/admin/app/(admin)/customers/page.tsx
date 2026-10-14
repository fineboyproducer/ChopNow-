import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Users } from "lucide-react";
import { Card, EmptyState } from "@chopnow/ui";
import { createSupabaseServerClient, formatDate } from "@chopnow/lib";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({
  searchParams,
}: {
  // Next.js 15 passes route searchParams as a Promise.
  searchParams: Promise<{ q?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  let query = supabase.from("profiles").select("*").eq("role", "customer").order("created_at", { ascending: false });
  if (resolvedSearchParams.q?.trim()) {
    query = query.or(`full_name.ilike.%${resolvedSearchParams.q}%,phone.ilike.%${resolvedSearchParams.q}%`);
  }
  const { data: customerRows } = await query.limit(50);
  const customers = customerRows ?? [];

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-extrabold text-foreground">Customers</h1>
        <p className="text-[12px] text-muted-foreground">Search by name or phone number</p>
      </div>

      <form className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={resolvedSearchParams.q}
          placeholder="Search customers..."
          className="w-full max-w-sm rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </form>

      {customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={resolvedSearchParams.q ? "No customers found" : "No customers yet"}
          description={
            resolvedSearchParams.q
              ? `Nothing matches "${resolvedSearchParams.q}".`
              : "Customers will appear here once they sign up."
          }
        />
      ) : (
        <div className="space-y-2">
          {customers.map((c) => (
            <Link key={c.id} href={`/customers/${c.id}`}>
              <Card className="flex items-center justify-between p-4">
                <div>
                  <p className="text-[13px] font-bold text-foreground">{c.full_name ?? "Unnamed customer"}</p>
                  <p className="text-[11px] text-muted-foreground">{c.phone ?? "No phone on file"}</p>
                </div>
                <span className="text-[11px] text-muted-foreground">Joined {formatDate(c.created_at)}</span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
