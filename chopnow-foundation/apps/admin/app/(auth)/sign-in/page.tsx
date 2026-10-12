import type { Metadata } from "next";
import { ChefHat } from "lucide-react";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ChefHat size={20} strokeWidth={2.4} />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">ChopNow Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in with your admin or dispatcher account.</p>
        </div>

        <SignInForm />

        <p className="mt-6 text-center text-[12px] text-muted-foreground">
          Admin and dispatcher accounts are created by an existing admin — there is no public
          sign-up for this dashboard.
        </p>
      </div>
    </div>
  );
}
