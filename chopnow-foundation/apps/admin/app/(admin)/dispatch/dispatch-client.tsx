"use client";

import * as React from "react";
import { Sparkles, ArrowRight, Bike, Info } from "lucide-react";
import { Card, Button, EmptyState } from "@chopnow/ui";
import { formatNaira, formatDistance, type RiderScoreBreakdown } from "@chopnow/lib";
import type { Database } from "@chopnow/lib/supabase/database.generated";
import { assignRiderToOrderAction, reassignRiderAction } from "@/lib/actions/riders";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type RiderRow = Database["public"]["Tables"]["riders"]["Row"];

interface Candidate {
  rider: RiderRow;
  name: string;
  distanceKm: number;
  score: RiderScoreBreakdown;
}

interface OrderCandidates {
  order: OrderRow;
  restaurantName: string;
  candidates: Candidate[];
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className="text-[10px] font-bold text-foreground">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function CandidateRow({
  candidate,
  isBest,
  orderId,
  alreadyAssigned,
}: {
  candidate: Candidate;
  isBest: boolean;
  orderId: string;
  alreadyAssigned: boolean;
}) {
  const [pending, setPending] = React.useState(false);

  const handleAssign = async () => {
    setPending(true);
    await (alreadyAssigned
      ? reassignRiderAction(orderId, candidate.rider.id)
      : assignRiderToOrderAction(orderId, candidate.rider.id));
    setPending(false);
  };

  return (
    <div className={`rounded-xl p-3 ${isBest ? "border border-primary bg-accent" : "border border-border bg-card"}`}>
      <div className="mb-2.5 flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[12px] font-bold text-foreground">
          {candidate.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-bold text-foreground">
            {candidate.name}{" "}
            {isBest && (
              <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
                <Sparkles size={8} /> Best match
              </span>
            )}
          </p>
          <p className="text-[10.5px] text-muted-foreground">
            Score {candidate.score.total}/100 · ⭐ {candidate.rider.rating} · {formatDistance(candidate.distanceKm)}
          </p>
        </div>
        <Button size="sm" onClick={handleAssign} disabled={pending}>
          {pending ? "..." : alreadyAssigned ? "Reassign" : "Assign"} <ArrowRight size={11} />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <ScoreBar label="Distance" value={candidate.score.distanceScore} />
        <ScoreBar label="Availability" value={candidate.score.availabilityScore} />
        <ScoreBar label="Rating" value={candidate.score.ratingScore} />
        <ScoreBar label="Workload" value={candidate.score.workloadScore} />
        <ScoreBar label="Acceptance" value={candidate.score.acceptanceScore} />
      </div>
    </div>
  );
}

export function DispatchClient({ orderCandidates }: { orderCandidates: OrderCandidates[] }) {
  const [selectedOrderId, setSelectedOrderId] = React.useState(orderCandidates[0]?.order.id ?? null);
  const selected = orderCandidates.find((oc) => oc.order.id === selectedOrderId);

  if (orderCandidates.length === 0) {
    return (
      <EmptyState
        icon={Bike}
        title="Nothing to dispatch right now"
        description="Orders ready for pickup will appear here with ranked rider suggestions."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
      <Card className="h-fit p-3">
        <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Awaiting dispatch ({orderCandidates.length})
        </p>
        <div className="space-y-1.5">
          {orderCandidates.map(({ order, restaurantName }) => (
            <button
              key={order.id}
              onClick={() => setSelectedOrderId(order.id)}
              className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                selectedOrderId === order.id ? "border border-primary bg-accent" : "border border-transparent hover:bg-muted"
              }`}
            >
              <p className="text-[12.5px] font-bold text-foreground">{order.order_number}</p>
              <p className="text-[11px] text-muted-foreground">
                {restaurantName} · {formatNaira(order.total)}
              </p>
              {order.status === "rider_assigned" && (
                <span className="mt-1 inline-block rounded-full bg-warning/10 px-1.5 py-0.5 text-[9px] font-bold text-warning">
                  Already assigned
                </span>
              )}
            </button>
          ))}
        </div>
      </Card>

      {!selected ? (
        <Card className="flex items-center justify-center p-10">
          <p className="text-[13px] text-muted-foreground">Select an order to see ranked rider candidates.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="p-4">
            <p className="mb-3 flex items-center gap-2 text-[12.5px] font-extrabold text-foreground">
              <Bike size={14} className="text-primary" /> Best-match riders for {selected.order.order_number}
            </p>
            {selected.candidates.length === 0 ? (
              <p className="py-6 text-center text-[12.5px] text-muted-foreground">
                No online riders available right now.
              </p>
            ) : (
              <div className="space-y-3">
                {selected.candidates.slice(0, 5).map((c, i) => (
                  <CandidateRow
                    key={c.rider.id}
                    candidate={c}
                    isBest={i === 0}
                    orderId={selected.order.id}
                    alreadyAssigned={selected.order.status === "rider_assigned"}
                  />
                ))}
              </div>
            )}
          </Card>

          <Card className="flex items-start gap-2.5 border-warning/30 p-4">
            <Info size={15} className="mt-0.5 shrink-0 text-warning" />
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              If the top-ranked rider rejects or does not respond within 45 seconds, the automatic
              dispatch engine offers the job to the next-ranked rider, per the Operations &amp;
              Dispatch Architecture, Section 1.3. This screen is also where a dispatcher can
              override that ranking manually at any time.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
