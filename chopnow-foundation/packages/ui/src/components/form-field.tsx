import * as React from "react";
import { cn } from "@chopnow/lib";
import { Label } from "./label";

export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  htmlFor: string;
  /** Validation error message. When present, renders below the field in destructive color. */
  error?: string;
  /** Optional helper text shown below the field when there's no error. */
  hint?: string;
  required?: boolean;
}

/**
 * Standard field wrapper: label + child input + error/hint text, with
 * consistent spacing. Use around any input-like component:
 *
 *   <FormField label="Email" htmlFor="email" error={errors.email}>
 *     <Input id="email" type="email" invalid={!!errors.email} {...register("email")} />
 *   </FormField>
 */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
  ...props
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)} {...props}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
