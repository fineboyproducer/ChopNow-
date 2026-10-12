import type { Metadata } from "next";
import { AddressesClient } from "./addresses-client";
import { listAddresses } from "@/lib/actions/addresses";

export const metadata: Metadata = { title: "Your addresses" };

export default async function AddressesPage() {
  const result = await listAddresses();
  return <AddressesClient initialAddresses={result.success ? result.data : []} />;
}
