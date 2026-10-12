"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button, FormField, Input } from "@chopnow/ui";
import type { ApiResponse } from "@chopnow/types";
import { signInAction } from "@/lib/actions/auth";

const initialState: ApiResponse<null> = { success: true, data: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Signing in..." : "Sign in"}
    </Button>
  );
}

export function SignInForm() {
  const [state, formAction] = useFormState(signInAction, initialState);
  const fieldErrors = !state.success ? state.error.fieldErrors ?? {} : {};

  return (
    <form action={formAction} className="space-y-4">
      <FormField label="Email" htmlFor="email" error={fieldErrors.email}>
        <Input id="email" name="email" type="email" placeholder="admin@chopnow.ng" required />
      </FormField>

      <FormField label="Password" htmlFor="password" error={fieldErrors.password}>
        <Input id="password" name="password" type="password" placeholder="••••••••" required />
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
