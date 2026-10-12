import type { Metadata } from "next";
import { Bell, CreditCard, HelpCircle, LogOut, ChevronRight } from "lucide-react";
import { Card } from "@chopnow/ui";
import { signOutAction } from "@/lib/actions/auth";

export const metadata: Metadata = { title: "Profile & settings" };

const SETTINGS_ITEMS = [
  { label: "Notifications", icon: Bell },
  { label: "Payment methods", icon: CreditCard },
  { label: "Help & Support", icon: HelpCircle },
];

export default function ProfilePage() {
  return (
    <Card className="space-y-1 p-2">
      {SETTINGS_ITEMS.map((item) => (
        <button
          key={item.label}
          className="flex w-full items-center justify-between rounded-xl px-3 py-3 transition-colors hover:bg-muted"
        >
          <span className="flex items-center gap-3 text-sm font-semibold text-foreground">
            <item.icon size={16} className="text-muted-foreground" /> {item.label}
          </span>
          <ChevronRight size={15} className="text-muted-foreground" />
        </button>
      ))}
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
  );
}
