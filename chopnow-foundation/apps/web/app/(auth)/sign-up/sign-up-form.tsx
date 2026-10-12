"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button, FormField, Input } from "@chopnow/ui";
import type { ApiResponse } from "@chopnow/types";
import { signUpAction } from "@/lib/actions/auth";

const initialState: ApiResponse<null> = { success: true, data: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Creating account..." : "Create account"}
    </Button>
  );
}

export function SignUpForm() {
  const [state, formAction] = useFormState(signUpAction, initialState);
  const fieldErrors = !state.success ? state.error.fieldErrors ?? {} : {};

  return (
    <form action={formAction} className="space-y-4">
      <FormField label="Full name" htmlFor="fullName" error={fieldErrors.fullName}>
        <Input id="fullName" name="fullName" placeholder="Chidera Okafor" required />
      </FormField>

      <FormField label="Email" htmlFor="email" error={fieldErrors.email}>
        <Input id="email" name="email" type="email" placeholder="you@example.com" required />
      </FormField>

      <FormField label="Phone number" htmlFor="phone" error={fieldErrors.phone} hint="e.g. 08031234567">
        <Input id="phone" name="phone" type="tel" placeholder="08031234567" required />
      </FormField>

      <FormField label="Password" htmlFor="password" error={fieldErrors.password}>
        <Input id="password" name="password" type="password" placeholder="••••••••" required />
      </FormField>

      <FormField
        label="Confirm password"
        htmlFor="confirmPassword"
        error={fieldErrors.confirmPassword}
      >
        <Input id="confirmPassword" name="confirmPassword" type="password" placeholder="••••••••" required />
      </FormField>

      {!state.success && !state.error.fieldErrors && (
        <p className="text-[13px] font-medium text-destructive" role="alert">
          {state.error.message}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
