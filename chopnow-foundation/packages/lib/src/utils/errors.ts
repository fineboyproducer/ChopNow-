import type { ApiErrorCode } from "@chopnow/types";

/**
 * Base class for all expected, "handled" application errors — as opposed
 * to unexpected bugs. Carries an ApiErrorCode so API routes can map it to
 * the right HTTP status and response shape without string-matching on
 * error messages.
 */
export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly httpStatus: number;
  readonly fieldErrors?: Record<string, string>;

  constructor(
    code: ApiErrorCode,
    message: string,
    httpStatus: number,
    fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.fieldErrors = fieldErrors;
  }

  static unauthenticated(message = "You must be signed in to do that.") {
    return new AppError("UNAUTHENTICATED", message, 401);
  }

  static forbidden(message = "You do not have permission to do that.") {
    return new AppError("FORBIDDEN", message, 403);
  }

  static notFound(message = "The requested resource was not found.") {
    return new AppError("NOT_FOUND", message, 404);
  }

  static validation(message: string, fieldErrors?: Record<string, string>) {
    return new AppError("VALIDATION_ERROR", message, 422, fieldErrors);
  }

  static conflict(message: string) {
    return new AppError("CONFLICT", message, 409);
  }

  static rateLimited(message = "Too many requests. Please try again shortly.") {
    return new AppError("RATE_LIMITED", message, 429);
  }

  static paymentFailed(message = "Payment could not be processed.") {
    return new AppError("PAYMENT_FAILED", message, 402);
  }

  static internal(message = "Something went wrong on our end.") {
    return new AppError("INTERNAL_ERROR", message, 500);
  }
}

/**
 * Normalizes any thrown value into an AppError, so a single catch block
 * in the API wrapper can handle both expected AppErrors and unexpected
 * exceptions (bugs, third-party library throws, etc.) uniformly.
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Error) return AppError.internal(error.message);
  return AppError.internal("An unexpected error occurred.");
}
