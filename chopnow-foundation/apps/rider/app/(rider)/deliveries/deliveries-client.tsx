"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, X, Phone, Navigation, Package, MapPinned } from "lucide-react";
import { Card, Button, EmptyState } from "@chopnow/ui";
import { formatNaira, formatDistance, haversineDistanceKm } from "@chopnow/lib";
import type { ActiveDeliveryData, PendingOffer } from "@/lib/data/deliveries";
import { acceptDeliveryOfferAction, rejectDeliveryOfferAction, advanceDeliveryAction } from "@/lib/actions/deliveries";
import { LiveMap, openNavigationTo } from "@/components/live-map";
import { LocationTracker } from "@/components/location-tracker";

const STAGE_BUTTON_LABEL: Record<string, string> = {
  rider_assigned: "Head to restaurant",
  rider_enroute_restaurant: "Mark picked up",
  picked_up: "Start delivery",
  heading_to_customer: "Mark delivered",
};

const STAGE_DESCRIPTION: Record<string, string> = {
  rider_assigned: "Navigate to the restaurant to collect this order.",
  rider_enroute_restaurant: "On your way to the restaurant — mark picked up once you have the order.",
  picked_up: "Order collected. Start heading to the customer.",
  heading_to_customer: "On your way to the customer — mark delivered on arrival.",
};

function OfferCard({ offer, onResolved }: { offer: PendingOffer; onResolved: (attemptId: string) => void }) {
  const [busy, setBusy] = React.useState<"accept" | "reject" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();

  const handleAccept = async () => {
    setBusy("accept");
    setError(null);
    const result = await acceptDeliveryOfferAction(offer.attempt.id);
    setBusy(null);
    if (result.success) {
      onResolved(offer.attempt.id);
      router.refresh();
    } else {
      setError(result.error.message);
    }
  };

  const handleReject = async () => {
    setBusy("reject");
    setError(null);
    const result = await rejectDeliveryOfferAction(offer.attempt.id);
    setBusy(null);
    if (result.success) onResolved(offer.attempt.id);
    else setError(result.error.message);
  };

  return (
    <Card className="border-2 border-primary p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-accent px-2.5 py-1 text-[10.5px] font-bold text-primary">New delivery request</span>
        <span className="text-[11px] text-muted-foreground">{offer.order.order_number}</span>
      </div>
      <p className="text-[15px] font-extrabold text-foreground">{offer.restaurant?.name ?? "Restaurant"}</p>
      <p className="mt-1 flex items-start gap-1.5 text-[12.5px] text-muted-foreground">
        <MapPinned size={13} className="mt-0.5 shrink-0" /> {offer.order.delivery_full_address}
      </p>
      <div className="mt-3 flex items-center justify-between rounded-lg bg-muted px-3 py-2.5">
        <span className="text-[11.5px] text-muted-foreground">
          {offer.itemCount} item{offer.itemCount !== 1 ? "s" : ""} · Order total
        </span>
        <span className="text-[13px] font-bold text-foreground">{formatNaira(offer.order.total)}</span>
      </div>
      {error && <p className="mt-2 text-[12px] font-medium text-destructive">{error}</p>}
      <div className="mt-4 flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={handleReject} disabled={busy !== null}>
          <X size={14} /> {busy === "reject" ? "..." : "Decline"}
        </Button>
        <Button className="flex-1" onClick={handleAccept} disabled={busy !== null}>
          <Check size={14} /> {busy === "accept" ? "..." : "Accept"}
        </Button>
      </div>
    </Card>
  );
}

function ActiveDeliveryCard({ data }: { data: ActiveDeliveryData }) {
  const [advancing, setAdvancing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();

  const buttonLabel = STAGE_BUTTON_LABEL[data.order.status] ?? "Advance";
  const description = STAGE_DESCRIPTION[data.order.status] ?? "";

  const headingToRestaurant = data.order.status === "rider_assigned" || data.order.status === "rider_enroute_restaurant";
  const destLat = headingToRestaurant ? Number(data.restaurant?.lat ?? 0) : Number(data.order.delivery_lat ?? 0);
  const destLng = headingToRestaurant ? Number(data.restaurant?.lng ?? 0) : Number(data.order.delivery_lng ?? 0);
  const originLat = Number(data.restaurant?.lat ?? 0);
  const originLng = Number(data.restaurant?.lng ?? 0);

  const handleAdvance = async () => {
    setAdvancing(true);
    setError(null);
    const result = await advanceDeliveryAction(data.order.id);
    setAdvancing(false);
    if (result.success) router.refresh();
    else setError(result.error.message);
  };

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-accent px-2.5 py-1 text-[10.5px] font-bold text-primary">
          Current delivery · {data.order.order_number}
        </span>
        <span className="text-[11px] font-bold text-muted-foreground">
          {formatDistance(haversineDistanceKm({ lat: originLat, lng: originLng }, { lat: destLat, lng: destLng }))}
        </span>
      </div>

      <p className="text-[16px] font-extrabold text-foreground">{data.restaurant?.name ?? "Restaurant"}</p>
      <p className="mt-1 flex items-start gap-1.5 text-[13px] text-muted-foreground">
        <MapPinned size={14} className="mt-0.5 shrink-0 text-primary" />
        Deliver to <strong className="text-foreground">{data.order.delivery_phone}</strong>, {data.order.delivery_full_address}
      </p>

      <div className="mt-3">
        <LiveMap
          originLat={originLat}
          originLng={originLng}
          destLat={destLat}
          destLng={destLng}
          originLabel={data.restaurant?.name ?? "Restaurant"}
          destLabel="Delivery address"
        />
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl bg-muted p-3">
        <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Package size={13} /> {data.itemCount} item{data.itemCount !== 1 ? "s" : ""} · Order total
        </span>
        <span className="text-[13px] font-bold text-foreground">{formatNaira(data.order.total)}</span>
      </div>

      <div className="mt-3 flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={() => openNavigationTo(destLat, destLng)}>
          <Navigation size={14} /> Navigate
        </Button>
        <a href={`tel:${data.order.delivery_phone}`} className="flex-1">
          <Button variant="ghost" className="w-full">
            <Phone size={14} /> Call
          </Button>
        </a>
      </div>

      {description && <p className="mt-3 text-[11.5px] text-muted-foreground">{description}</p>}
      {error && <p className="mt-2 text-[12px] font-medium text-destructive">{error}</p>}

      <Button onClick={handleAdvance} disabled={advancing} className="mt-3 w-full py-3.5 text-[14px]">
        {advancing ? "Updating..." : buttonLabel}
      </Button>
    </Card>
  );
}

export function DeliveriesClient({
  activeDelivery,
  initialOffers,
}: {
  activeDelivery: ActiveDeliveryData | null;
  initialOffers: PendingOffer[];
}) {
  const [offers, setOffers] = React.useState(initialOffers);

  const handleOfferResolved = (attemptId: string) => {
    setOffers((prev) => prev.filter((o) => o.attempt.id !== attemptId));
  };

  return (
    <div className="space-y-4 p-4">
      <LocationTracker enabled={!!activeDelivery} />

      {activeDelivery ? (
        <ActiveDeliveryCard data={activeDelivery} />
      ) : offers.length > 0 ? (
        <div className="space-y-3">
          {offers.map((offer) => (
            <OfferCard key={offer.attempt.id} offer={offer} onResolved={handleOfferResolved} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Package}
          title="Waiting for orders"
          description="We'll notify you the moment a delivery is ready nearby. Make sure you're online (see the toggle above)."
        />
      )}
    </div>
  );
}
