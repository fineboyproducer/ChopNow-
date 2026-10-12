import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRestaurantBySlug } from "@/lib/data/restaurants";
import { RestaurantHeader } from "@/components/customer/restaurant-header";
import { RestaurantMenu } from "@/components/customer/restaurant-menu";

interface RestaurantPageProps {
  // Next.js 15 passes dynamic route params as a Promise.
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: RestaurantPageProps): Promise<Metadata> {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  return { title: restaurant?.name ?? "Restaurant" };
}

export default async function RestaurantPage({ params }: RestaurantPageProps) {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) notFound();

  return (
    <div className="pb-16">
      <RestaurantHeader restaurant={restaurant} />
      <RestaurantMenu restaurant={restaurant} />
    </div>
  );
}
