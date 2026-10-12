import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createSupabaseServerClient, getAuthenticatedUser, hasRole } from "@chopnow/lib";
import { RiderBottomNav } from "@/components/rider-bottom-nav";
import { RiderTopBar } from "@/components/rider-top-bar";

export default async function RiderLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const user = await getAuthenticatedUser(supabase);

  if (!hasRole(user, "rider")) {
    redirect("/sign-in");
  }

  const { data: riderRow } = await supabase.from("riders").select("*").eq("id", user!.id).single();

  return (
    <div className="min-h-screen bg-background pb-20">
      <RiderTopBar riderName={user!.profile?.fullName ?? "Rider"} isOnline={riderRow?.is_online ?? false} />
      <main>{children}</main>
      <RiderBottomNav />
    </div>
  );
}
