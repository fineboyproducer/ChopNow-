/**
 * Standard envelope every ChopNow API route returns, so client code
 * never has to guess the response shape or handle two different error
 * conventions across endpoints.
 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    /** Present for validation failures — field name -> human message. */
    fieldErrors?: Record<string, string>;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/** Common, stable error codes used across API routes and server actions. */
export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PAYMENT_FAILED"
  | "INTERNAL_ERROR";

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
