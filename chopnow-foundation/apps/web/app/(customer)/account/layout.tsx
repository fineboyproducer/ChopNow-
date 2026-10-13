import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { createSupabaseServerClient, getAuthenticatedUser } from "@chopnow/lib";
import { AccountTabs } from "./account-tabs";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const user = await getAuthenticatedUser(supabase);

  const displayName = user?.profile?.fullName?.trim() || "Welcome back";
  const subtitle = user?.profile?.phone || user?.email || "";
  const initial = (user?.profile?.fullName?.trim()?.[0] || user?.email?.[0] || "C").toUpperCase();

  return (
    <div className="mx-auto max-w-2xl px-5 pb-16 pt-6 md:px-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-black text-primary-foreground">
          {initial}
        </div>
        <div>
          <h1 className="text-xl font-black tracking-tight text-foreground">{displayName}</h1>
          {subtitle && <p className="text-[12px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>

      <AccountTabs />

      {children}
    </div>
  );
}
