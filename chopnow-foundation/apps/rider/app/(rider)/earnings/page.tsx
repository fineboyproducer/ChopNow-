import type { Metadata } from "next";
import { Wallet, TrendingUp, Package } from "lucide-react";
import { Card } from "@chopnow/ui";
import { formatNaira, formatDateTime } from "@chopnow/lib";
import { getEarningsSummary, getEarningsHistory } from "@/lib/data/earnings";

export const metadata: Metadata = { title: "Earnings" };

export default async function EarningsPage() {
  const [summary, recent] = await Promise.all([getEarningsSummary(), getEarningsHistory(10)]);

  return (
    <div className="space-y-4 p-4">
      <Card className="bg-primary p-5 text-primary-foreground">
        <p className="text-[11px] font-bold uppercase tracking-wide opacity-80">Today&apos;s earnings</p>
        <p className="mt-1 text-[32px] font-black tracking-tight">{formatNaira(summary.todayTotal)}</p>
        <p className="mt-1 text-[12px] opacity-90">
          {summary.todayDeliveries} deliver{summary.todayDeliveries !== 1 ? "ies" : "y"} completed today
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary">
            <TrendingUp size={15} />
          </div>
          <p className="text-lg font-black text-foreground">{formatNaira(summary.weekTotal)}</p>
          <p className="text-[11px] text-muted-foreground">This week · {summary.weekDeliveries} deliveries</p>
        </Card>
        <Card className="p-4">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary">
            <Package size={15} />
          </div>
          <p className="text-lg font-black text-foreground">{formatNaira(summary.allTimeTotal)}</p>
          <p className="text-[11px] text-muted-foreground">All time · {summary.allTimeDeliveries} deliveries</p>
        </Card>
      </div>

      <Card className="p-4">
        <p className="mb-3 flex items-center gap-2 text-[12.5px] font-extrabold text-foreground">
          <Wallet size={14} className="text-primary" /> Recent payouts
        </p>
        {recent.length === 0 ? (
          <p className="py-6 text-center text-[12.5px] text-muted-foreground">
            Complete your first delivery to see earnings here.
          </p>
        ) : (
          <div className="space-y-2">
            {recent.map((r) => (
              <div key={r.orderId} className="flex items-center justify-between rounded-lg px-2.5 py-2">
                <div>
                  <p className="text-[12.5px] font-bold text-foreground">{r.restaurantName}</p>
                  <p className="text-[10.5px] text-muted-foreground">
                    {r.orderNumber} · {formatDateTime(r.deliveredAt)}
                  </p>
                </div>
                <span className="text-[13px] font-bold text-success">+{formatNaira(r.earnings)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
