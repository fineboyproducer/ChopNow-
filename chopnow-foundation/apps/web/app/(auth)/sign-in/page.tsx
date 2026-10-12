import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  // Next.js 15 passes route searchParams as a Promise.
  searchParams: Promise<{ redirectTo?: string; confirmEmail?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-accent px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-lg font-black text-primary-foreground">
            C
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to order from ChopNow.</p>
        </div>

        {resolvedSearchParams.confirmEmail && (
          <div className="mb-4 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-[13px] text-success">
            Check your email to confirm your account before signing in.
          </div>
        )}

        <SignInForm redirectTo={resolvedSearchParams.redirectTo} />

        <p className="mt-6 text-center text-[13px] text-muted-foreground">
          New to ChopNow?{" "}
          <Link href="/sign-up" className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
