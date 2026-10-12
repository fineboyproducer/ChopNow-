import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-accent px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-lg font-black text-primary-foreground">
            C
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">
            Create your account
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Order hot meals from restaurants near you.
          </p>
        </div>

        <SignUpForm />

        <p className="mt-6 text-center text-[13px] text-muted-foreground">
          Already have an account?{" "}
          <Link href="/sign-in" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
