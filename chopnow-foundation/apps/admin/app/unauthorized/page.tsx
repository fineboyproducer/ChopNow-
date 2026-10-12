import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@chopnow/ui";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
        <ShieldAlert className="h-7 w-7 text-destructive" strokeWidth={1.6} />
      </div>
      <h1 className="text-xl font-extrabold tracking-tight text-foreground">
        You don&apos;t have access to this
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        This dashboard is restricted to ChopNow admin and dispatcher accounts.
      </p>
      <Button asChild className="mt-6">
        <Link href="/sign-in">Back to sign in</Link>
      </Button>
    </div>
  );
}
