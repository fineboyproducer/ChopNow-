import { z } from "zod";

/**
 * Nigerian phone numbers: accepts local (0803...) and international
 * (+234803...) formats, 10-11 digits after the prefix.
 */
export const phoneSchema = z
  .string()
  .trim()
  .regex(
    /^(\+234|0)[789][01]\d{8}$/,
    "Enter a valid Nigerian phone number, e.g. 08031234567 or +2348031234567",
  );

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address");

export const signInWithPasswordSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export type SignInWithPasswordInput = z.infer<typeof signInWithPasswordSchema>;

export const signUpSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name"),
    email: emailSchema,
    phone: phoneSchema,
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data: { password: string; confirmPassword: string }) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type SignUpInput = z.infer<typeof signUpSchema>;

export const phoneOtpRequestSchema = z.object({
  phone: phoneSchema,
});
export type PhoneOtpRequestInput = z.infer<typeof phoneOtpRequestSchema>;

export const phoneOtpVerifySchema = z.object({
  phone: phoneSchema,
  token: z.string().length(6, "Enter the 6-digit code sent to your phone"),
});
export type PhoneOtpVerifyInput = z.infer<typeof phoneOtpVerifySchema>;

export const addressSchema = z.object({
  label: z.string().trim().max(40).optional(),
  fullAddress: z.string().trim().min(5, "Enter a complete address"),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  isDefault: z.boolean().optional(),
});
export type AddressInput = z.infer<typeof addressSchema>;

export const menuItemSchema = z.object({
  name: z.string().trim().min(2, "Enter an item name"),
  description: z.string().trim().max(500).optional(),
  basePrice: z.number().positive("Price must be greater than zero"),
  categoryId: z.string().uuid().optional(),
  isAvailable: z.boolean().default(true),
});
export type MenuItemInput = z.infer<typeof menuItemSchema>;

export const restaurantSchema = z.object({
  name: z.string().trim().min(2, "Enter a restaurant name"),
  description: z.string().trim().max(1000).optional(),
  category: z.string().trim().optional(),
  phone: phoneSchema,
  address: z.string().trim().min(5, "Enter a complete address"),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  baseDeliveryFee: z.number().nonnegative(),
});
export type RestaurantInput = z.infer<typeof restaurantSchema>;

/**
 * Parses `input` against `schema`, returning either the parsed value or a
 * flattened field-error map suitable for handing straight to AppError.validation
 * or to a form library's error state.
 */
export function safeParseWithFieldErrors<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown,
): { success: true; data: z.infer<T> } | { success: false; fieldErrors: Record<string, string> } {
  const result = schema.safeParse(input);
  if (result.success) return { success: true, data: result.data };

  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".") || "_root";
    if (!fieldErrors[path]) fieldErrors[path] = issue.message;
  }
  return { success: false, fieldErrors };
}
