import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Star, TrendingUp, Clock, Bike, LogOut, ChevronRight } from "lucide-react";
import { Card } from "@chopnow/ui";
import { createSupabaseServerClient, getAuthenticatedUser } from "@chopnow/lib";
import { signOutAction } from "@/lib/actions/auth";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const user = await getAuthenticatedUser(supabase);

  const { data: rider } = await supabase.from("riders").select("*").eq("id", user!.id).single();

  return (
    <div className="space-y-4 p-4">
      <Card className="flex items-center gap-4 p-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-xl font-black text-primary">
          {(user!.profile?.fullName ?? "R").charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-[15px] font-extrabold text-foreground">{user!.profile?.fullName ?? "Rider"}</p>
          <p className="text-[12px] text-muted-foreground">{user!.profile?.phone ?? user!.email}</p>
          <p className="mt-0.5 text-[11px] capitalize text-muted-foreground">
            {rider?.vehicle_type ?? "motorbike"}
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3.5 text-center">
          <Star size={16} className="mx-auto mb-1.5 text-primary" />
          <p className="text-[15px] font-black text-foreground">{rider?.rating ?? "5.0"}</p>
          <p className="text-[10px] text-muted-foreground">Rating</p>
        </Card>
        <Card className="p-3.5 text-center">
          <TrendingUp size={16} className="mx-auto mb-1.5 text-primary" />
          <p className="text-[15px] font-black text-foreground">{rider?.acceptance_rate ?? 100}%</p>
          <p className="text-[10px] text-muted-foreground">Accept rate</p>
        </Card>
        <Card className="p-3.5 text-center">
          <Clock size={16} className="mx-auto mb-1.5 text-primary" />
          <p className="text-[15px] font-black text-foreground">{rider?.avg_delivery_minutes ?? 25}m</p>
          <p className="text-[10px] text-muted-foreground">Avg time</p>
        </Card>
      </div>

      <Card className="p-2">
        <button className="flex w-full items-center justify-between rounded-xl px-3 py-3 transition-colors hover:bg-muted">
          <span className="flex items-center gap-3 text-sm font-semibold text-foreground">
            <Bike size={16} className="text-muted-foreground" /> Vehicle details
          </span>
          <ChevronRight size={15} className="text-muted-foreground" />
        </button>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center justify-between rounded-xl px-3 py-3 transition-colors hover:bg-destructive/10"
          >
            <span className="flex items-center gap-3 text-sm font-semibold text-destructive">
              <LogOut size={16} /> Log out
            </span>
            <ChevronRight size={15} className="text-destructive/60" />
          </button>
        </form>
      </Card>
    </div>
  );
}
