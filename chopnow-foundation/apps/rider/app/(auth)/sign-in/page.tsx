import type { Metadata } from "next";
import { LogoMark } from "@chopnow/ui";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <LogoMark size={52} className="mx-auto mb-4" />
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">
            Chop<span className="text-primary">Now</span> Rider
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to start accepting deliveries.</p>
        </div>
        <SignInForm />
        <p className="mt-6 text-center text-[12px] text-muted-foreground">
          Rider accounts are created by ChopNow admin — there is no public sign-up.
        </p>
      </div>
    </div>
  );
}
