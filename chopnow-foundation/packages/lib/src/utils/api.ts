import { NextResponse, type NextRequest } from "next/server";
import type { ApiResponse } from "@chopnow/types";
import { toAppError } from "./errors";
import { createLogger } from "./logger";

const log = createLogger("api");

/**
 * Wraps a Next.js Route Handler so every endpoint returns the same
 * ApiResponse<T> envelope and every thrown error is caught, logged, and
 * converted into a well-formed error response — instead of each route
 * hand-rolling its own try/catch and status codes.
 *
 * Usage:
 *   export const POST = withApiHandler(async (request) => {
 *     const body = await request.json();
 *     const order = await createOrder(body);
 *     return order; // wrapped as { success: true, data: order }
 *   });
 */
export function withApiHandler<T>(
  // Route Handlers always receive a NextRequest at runtime (it's a
  // superset of Request with cookies/nextUrl/etc.), so the handler type
  // here must match that, not the narrower plain Request — a handler
  // declared to accept NextRequest (to actually use those extras) isn't
  // assignable to a plain-Request parameter under strict function types.
  handler: (request: NextRequest, context: { params: Record<string, string> }) => Promise<T>,
) {
  return async (
    request: NextRequest,
    // Next.js 15's Route Handler params are always a Promise — a union
    // with the old Next 14 sync shape looks backwards-compatible, but
    // `next build` type-checks every exported GET/POST/etc. against its
    // own generated RouteContext type, which only accepts this exact
    // Promise shape. The union was rejected outright, not silently
    // widened, so this wrapper never actually worked under Next 15.
    context: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse<ApiResponse<T>>> => {
    try {
      const resolvedParams = await context.params;
      const data = await handler(request, { params: resolvedParams });
      return NextResponse.json({ success: true, data });
    } catch (error) {
      const appError = toAppError(error);
      log.error(`Request failed: ${request.method} ${new URL(request.url).pathname}`, appError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: appError.code,
            message: appError.message,
            ...(appError.fieldErrors ? { fieldErrors: appError.fieldErrors } : {}),
          },
        },
        { status: appError.httpStatus },
      );
    }
  };
}

/**
 * Client-side fetch wrapper that understands the ApiResponse envelope and
 * throws a plain Error with the server's message on failure, so calling
 * code can use a normal try/catch instead of checking `.success` everywhere.
 */
export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  const body = (await response.json()) as ApiResponse<T>;

  if (!body.success) {
    throw new Error(body.error.message);
  }

  return body.data;
}
