import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AuthenticatedUser } from "@chopnow/types";

// ----------------------------------------------------------------------------
// Test doubles
// ----------------------------------------------------------------------------
// assignRiderToOrderAction is a Next.js Server Action: it calls
// next/headers' cookies(), builds a Supabase client via
// createSupabaseServerClient, and resolves the caller via
// getAuthenticatedUser. None of that is available in a plain Node test
// process, so those three are mocked below. Everything else from
// "@chopnow/lib" (AppError, toAppError, requireRole, hasRole) is left as
// the real implementation — those are pure functions and exercising them
// for real is what proves requireRole's role check actually rejects a
// non-admin caller.

const mockFrom = vi.fn();
const mockGetAuthenticatedUser = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({})),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@chopnow/lib", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@chopnow/lib")>();
  return {
    ...actual,
    createSupabaseServerClient: vi.fn(() => ({ from: mockFrom })),
    getAuthenticatedUser: mockGetAuthenticatedUser,
    // Silence log output during the test run; createLogger itself is
    // untouched production code we don't need to re-verify here.
    createLogger: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  };
});

const { assignRiderToOrderAction } = await import("./riders");

/**
 * A minimal fake Supabase query-builder: every filter/select method
 * returns itself so calls can be chained in any order the real
 * supabase-js builder supports, `.single()`/`.maybeSingle()` resolve the
 * configured result, and the object is itself "thenable" so code that
 * awaits the builder directly without a terminal method (as
 * assignRiderToOrderAction does for the riders-table status update)
 * resolves the same way.
 */
function fakeQuery(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "is", "update", "insert"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.single = vi.fn(async () => result);
  chain.maybeSingle = vi.fn(async () => result);
  chain.then = (onResolve: (value: typeof result) => unknown, onReject: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(onResolve, onReject);
  return chain;
}

const ADMIN_USER: AuthenticatedUser = {
  id: "admin-1",
  email: "admin@chopnow.test",
  phone: null,
  profile: {
    id: "admin-1",
    role: "admin",
    fullName: "Test Admin",
    phone: null,
    avatarUrl: null,
    createdAt: new Date().toISOString(),
  },
};

const CUSTOMER_USER: AuthenticatedUser = {
  ...ADMIN_USER,
  id: "customer-1",
  profile: { ...ADMIN_USER.profile!, id: "customer-1", role: "customer" },
};

const VALID_RIDER = { id: "rider-1", is_online: true, is_active: true };

beforeEach(() => {
  mockFrom.mockReset();
  mockGetAuthenticatedUser.mockReset();
  mockGetAuthenticatedUser.mockResolvedValue(ADMIN_USER);
});

describe("assignRiderToOrderAction", () => {
  it("assigns a rider to an order that is ready for pickup", async () => {
    mockFrom
      .mockImplementationOnce(() => fakeQuery({ data: { id: "order-1", status: "ready_for_pickup", rider_id: null }, error: null })) // orders select
      .mockImplementationOnce(() => fakeQuery({ data: VALID_RIDER, error: null })) // riders select
      .mockImplementationOnce(() => fakeQuery({ data: { id: "order-1" }, error: null })) // orders update (atomic, status-scoped)
      .mockImplementationOnce(() => fakeQuery({ data: null, error: null })) // riders update -> status: assigned
      .mockImplementationOnce(() => fakeQuery({ data: null, error: null })); // dispatch_attempts insert

    const result = await assignRiderToOrderAction("order-1", "rider-1");

    expect(result.success).toBe(true);
    // Reached and executed every step, including the final audit-trail insert.
    expect(mockFrom).toHaveBeenCalledTimes(5);
  });

  it.each([["cancelled"], ["delivered"], ["completed"]] as const)(
    "rejects assignment when the order is already %s",
    async (status) => {
      mockFrom.mockImplementationOnce(() => fakeQuery({ data: { id: "order-1", status, rider_id: null }, error: null }));

      const result = await assignRiderToOrderAction("order-1", "rider-1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("CONFLICT");
        expect(result.error.message).toContain(status);
      }
      // Must stop at the status check — never reach the rider lookup or
      // any write, so a terminal order can't be mutated at all.
      expect(mockFrom).toHaveBeenCalledTimes(1);
    },
  );

  it("rejects assignment attempts from a non-admin/dispatcher user", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(CUSTOMER_USER);

    const result = await assignRiderToOrderAction("order-1", "rider-1");

    expect(result.success).toBe(false);
    // requireRole rejects before any Supabase call is ever made.
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("rejects assignment when the order's status changed between the read and the write (concurrency)", async () => {
    mockFrom
      // At read time the order still looks eligible...
      .mockImplementationOnce(() => fakeQuery({ data: { id: "order-1", status: "ready_for_pickup", rider_id: null }, error: null }))
      .mockImplementationOnce(() => fakeQuery({ data: VALID_RIDER, error: null }))
      // ...but by the time the status-scoped UPDATE runs, a concurrent
      // change (e.g. another admin cancelling it) means the WHERE clause
      // no longer matches any row, so Postgres returns zero rows.
      .mockImplementationOnce(() => fakeQuery({ data: null, error: null }));

    const result = await assignRiderToOrderAction("order-1", "rider-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("CONFLICT");
      expect(result.error.message).toMatch(/no longer eligible/i);
    }
    // Crucially: the riders-table status update and the dispatch_attempts
    // audit insert must NEVER run once the order update itself reports
    // zero rows affected — otherwise the rider would be marked "assigned"
    // and an audit row would be written for an order that was never
    // actually (re)assigned, corrupting rider/order state out of sync.
    expect(mockFrom).toHaveBeenCalledTimes(3);
  });
});
