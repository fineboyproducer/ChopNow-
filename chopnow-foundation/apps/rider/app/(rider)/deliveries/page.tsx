import type { Metadata } from "next";
import { getActiveDelivery, getPendingOffers } from "@/lib/data/deliveries";
import { DeliveriesClient } from "./deliveries-client";

export const metadata: Metadata = { title: "Deliveries" };

export default async function DeliveriesPage() {
  const activeDelivery = await getActiveDelivery();
  const pendingOffers = activeDelivery ? [] : await getPendingOffers();

  return <DeliveriesClient activeDelivery={activeDelivery} initialOffers={pendingOffers} />;
}
