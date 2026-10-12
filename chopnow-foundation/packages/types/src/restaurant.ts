export type RestaurantStatus = "open" | "busy" | "offline";

export interface OpeningHours {
  /** Keyed by lowercase 3-letter day abbreviation, e.g. "mon", "tue". */
  [day: string]: { open: string; close: string } | null;
}

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  coverUrl: string | null;
  logoUrl: string | null;
  phone: string | null;
  address: string | null;
  lat: number;
  lng: number;
  openingHours: OpeningHours | null;
  status: RestaurantStatus;
  isFeatured: boolean;
  baseDeliveryFee: number;
  /** Overrides the global markup percent when set; null = use global setting. */
  markupPercentOverride: number | null;
  rating: number;
  reviewCount: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MenuCategory {
  id: string;
  restaurantId: string;
  name: string;
  sortOrder: number;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  /** The restaurant's own price, before ChopNow's markup is applied. */
  basePrice: number;
  isAvailable: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** A menu item with the customer-facing (marked-up) price attached. */
export interface MenuItemWithDisplayPrice extends MenuItem {
  displayPrice: number;
}
