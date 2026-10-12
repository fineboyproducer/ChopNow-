import Link from "next/link";
import { Frown } from "lucide-react";
import { Button } from "@chopnow/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent">
        <Frown size={28} className="text-primary" strokeWidth={1.6} />
      </div>
      <p className="mb-1 text-[13px] font-black tracking-widest text-muted-foreground/40">404</p>
      <h1 className="text-xl font-extrabold tracking-tight text-foreground">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
      </p>
      <Button asChild className="mt-6">
        <Link href="/home">Back to home</Link>
      </Button>
    </div>
  );
}
