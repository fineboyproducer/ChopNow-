import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@chopnow/lib";
import type { Database } from "@chopnow/lib/supabase/database.generated";
import { AlertsClient } from "./alerts-client";

export const metadata: Metadata = { title: "Alerts" };

type AlertRow = Database["public"]["Tables"]["alerts"]["Row"];

export default async function AlertsPage() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const [{ data: activeAlerts }, { data: resolvedAlerts }] = await Promise.all([
    supabase.from("alerts").select("*").is("resolved_at", null).order("created_at", { ascending: false }),
    supabase
      .from("alerts")
      .select("*")
      .not("resolved_at", "is", null)
      .order("resolved_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-lg font-extrabold text-foreground">Alerts</h1>
        <p className="text-[12px] text-muted-foreground">
          Real-time operational alerts, per PRD Section 11.4. Color-coded by severity.
        </p>
      </div>

      <AlertsClient
        initialActiveAlerts={(activeAlerts ?? []) as AlertRow[]}
        initialResolvedAlerts={(resolvedAlerts ?? []) as AlertRow[]}
      />
    </div>
  );
}
