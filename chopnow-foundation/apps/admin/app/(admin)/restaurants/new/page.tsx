import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { NewRestaurantForm } from "./new-restaurant-form";

export const metadata: Metadata = { title: "Add restaurant" };

export default function NewRestaurantPage() {
  return (
    <div className="mx-auto max-w-xl space-y-5 p-6">
      <Link href="/restaurants" className="flex items-center gap-1.5 text-[13px] font-bold text-muted-foreground">
        <ChevronLeft size={16} /> Back to restaurants
      </Link>
      <div>
        <h1 className="text-lg font-extrabold text-foreground">Add a new restaurant</h1>
        <p className="text-[12px] text-muted-foreground">
          Per the ChopNow operating model, restaurants never sign up themselves — enter their
          details here after confirming interest and collecting a menu (see PRD Section 7.9). The
          restaurant is created as Offline; switch it to Open once you&apos;ve verified everything
          with a test order.
        </p>
      </div>
      <NewRestaurantForm />
    </div>
  );
}
