export type RiderStatus =
  | "idle"
  | "assigned"
  | "enroute_restaurant"
  | "picked_up"
  | "delivering";

export interface Rider {
  id: string;
  vehicleType: string;
  isOnline: boolean;
  status: RiderStatus;
  currentLat: number | null;
  currentLng: number | null;
  rating: number;
  acceptanceRate: number;
  avgDeliveryMinutes: number;
  isActive: boolean;
  createdAt: string;
}

export interface RiderEarning {
  id: string;
  riderId: string;
  orderId: string;
  amount: number;
  createdAt: string;
}

export interface Address {
  id: string;
  userId: string;
  label: string | null;
  fullAddress: string;
  lat: number;
  lng: number;
  isDefault: boolean;
  createdAt: string;
}
