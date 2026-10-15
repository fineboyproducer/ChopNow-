import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "./test-db";

/**
 * Runs the real 0013 alert rules against the real schema (see test-db.ts).
 * Time is controlled through the p_now argument of the core generator, so
 * "31 minutes later" doesn't need sleeping. Status changes go through real
 * UPDATEs, so the order_status_history triggers do their normal job.
 */
let db: PGlite;
let customerId: string;
let restaurantId: string;
let staffId: string;
let plainCustomerId: string;

const MIN = 60_000;

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

async function newOrder(status = "new", riderId: string | null = null): Promise<string> {
  const [row] = await q<{ id: string }>(
    `insert into orders (customer_id, restaurant_id, status, rider_id, delivery_full_address, delivery_phone,
                         subtotal, delivery_fee, service_fee, total, payment_method)
     values ($1, $2, $3, $4, 'addr', '080', 1000, 200, 50, 1250, 'paystack') returning id`,
    [customerId, restaurantId, status, riderId],
  );
  return row!.id;
}

async function setStatus(orderId: string, status: string) {
  await q(`update orders set status = $2 where id = $1`, [orderId, status]);
}

/** Run the generator as if `afterMs` had passed since now. */
async function run(afterMs = 0) {
  const [row] = await q<{ r: { created: number; reopened: number; resolved: number } }>(
    `select public._generate_operational_alerts(now() + ($1 || ' milliseconds')::interval) as r`,
    [String(afterMs)],
  );
  return row!.r;
}

const alertsFor = (orderId: string) =>
  q<{ id: string; type: string; severity: string; message: string; resolved_at: string | null; resolved_by: string | null; incident_key: string }>(
    `select id, type::text, severity, message, resolved_at, resolved_by, incident_key from alerts where order_id = $1 order by created_at, id`,
    [orderId],
  );

beforeAll(async () => {
  db = await createTestDb();
  const [c] = await q<{ id: string }>(`insert into auth.users (email) values ('c@x.test') returning id`);
  const [s] = await q<{ id: string }>(`insert into auth.users (email) values ('s@x.test') returning id`);
  const [p] = await q<{ id: string }>(`insert into auth.users (email) values ('p@x.test') returning id`);
  customerId = c!.id;
  staffId = s!.id;
  plainCustomerId = p!.id;
  await q(`update profiles set role = 'admin' where id = $1`, [staffId]);
  const [r] = await q<{ id: string }>(
    `insert into restaurants (name, slug, lat, lng) values ('Mama Put', 'mama-put', 6.7, 6.1) returning id`,
  );
  restaurantId = r!.id;
}, 120_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await q(`delete from alerts`);
  await q(`delete from activity_log`);
  await q(`delete from dispatch_attempts`);
  await q(`delete from order_status_history`);
  await q(`delete from orders`);
  await q(`update platform_settings set value = '3600' where key = 'alert_undelivered_window_seconds'`);
});

describe("stage rules", () => {
  it("does not alert while an order is inside its alert threshold", async () => {
    const id = await newOrder("restaurant_notified");
    expect(await run(4 * MIN)).toEqual({ created: 0, reopened: 0, resolved: 0 });
    expect(await alertsFor(id)).toHaveLength(0);
  });

  it("does not treat normal preparation time as a delay: 20m is past the 15m SLA but under the 30m alert threshold", async () => {
    const id = await newOrder("preparing");
    await run(20 * MIN);
    expect(await alertsFor(id)).toHaveLength(0);
  });

  it("raises a restaurant_delay once preparing exceeds its alert threshold", async () => {
    const id = await newOrder("preparing");
    const res = await run(31 * MIN);
    expect(res.created).toBe(1);
    const [a] = await alertsFor(id);
    expect(a).toMatchObject({ type: "restaurant_delay", severity: "amber", resolved_at: null, resolved_by: null });
    expect(a!.message).toMatch(/^CN-\d+ \(Mama Put\) has been in "Preparing" for 31m \(alert threshold 30m\)$/);
    expect(a!.incident_key).toMatch(/^stage:preparing:\d+$/);
  });

  it("raises a red no_rider_accepted for an order awaiting a rider assignment", async () => {
    const id = await newOrder("ready_for_pickup");
    await run(6 * MIN);
    const [a] = await alertsFor(id);
    expect(a).toMatchObject({ type: "no_rider_accepted", severity: "red" });
    expect(a!.message).toContain("with no rider assigned");
  });

  it("does not raise no_rider_accepted when a rider is already on the order", async () => {
    const [rp] = await q<{ id: string }>(`insert into auth.users (email) values ('r@x.test') returning id`);
    await q(`insert into riders (id) values ($1)`, [rp!.id]);
    const id = await newOrder("ready_for_pickup", rp!.id);
    await run(10 * MIN);
    expect(await alertsFor(id)).toHaveLength(0);
  });

  it("raises rider_delay for rider-side stages", async () => {
    const a = await newOrder("rider_assigned");
    const b = await newOrder("heading_to_customer");
    await run(31 * MIN);
    expect((await alertsFor(a)).map((x) => x.type)).toContain("rider_delay");
    expect((await alertsFor(b)).map((x) => x.type)).toContain("rider_delay");
  });

  it("never alerts on unpaid, delivered, completed, cancelled or refunded orders, however old", async () => {
    const ids = [];
    for (const s of ["new", "delivered", "completed", "cancelled", "refunded"]) ids.push(await newOrder(s));
    expect(await run(48 * 60 * MIN)).toEqual({ created: 0, reopened: 0, resolved: 0 });
    for (const id of ids) expect(await alertsFor(id)).toHaveLength(0);
  });

  it("skips orders that have no matching status-history row instead of guessing", async () => {
    const id = await newOrder("preparing");
    await q(`delete from order_status_history where order_id = $1`, [id]);
    await run(120 * MIN);
    expect(await alertsFor(id)).toHaveLength(0);
  });

  it("can be disabled per stage by setting alert_after_seconds to null", async () => {
    await q(`update stage_sla_config set alert_after_seconds = null where stage = 'preparing'`);
    const id = await newOrder("preparing");
    await run(120 * MIN);
    expect(await alertsFor(id)).toHaveLength(0);
    await q(`update stage_sla_config set alert_after_seconds = 1800 where stage = 'preparing'`);
  });

  it("refuses an alert threshold below the stage SLA", async () => {
    await expect(
      q(`update stage_sla_config set alert_after_seconds = 10 where stage = 'preparing'`),
    ).rejects.toThrow(/stage_sla_alert_not_before_sla/);
  });
});

describe("undelivered window", () => {
  it("raises customer_wait_exceeded when a paid order is undelivered past the window, even if its current stage is fresh", async () => {
    const id = await newOrder("new");
    await setStatus(id, "payment_confirmed");
    await setStatus(id, "heading_to_customer");
    await q(
      `update order_status_history set changed_at = now() - interval '61 minutes' where order_id = $1 and status = 'payment_confirmed'`,
      [id],
    );
    await run(0);
    const types = (await alertsFor(id)).map((a) => a.type);
    expect(types).toEqual(["customer_wait_exceeded"]);
    const [a] = await alertsFor(id);
    expect(a!.severity).toBe("red");
    expect(a!.message).toMatch(/still undelivered 1h 1m after payment \(limit 1h\)/);
  });

  it("honours the configurable window", async () => {
    await q(`update platform_settings set value = '600' where key = 'alert_undelivered_window_seconds'`);
    const id = await newOrder("new");
    await setStatus(id, "payment_confirmed");
    await setStatus(id, "heading_to_customer");
    await run(11 * MIN);
    expect((await alertsFor(id)).map((a) => a.type)).toContain("customer_wait_exceeded");
  });
});

describe("duplicate prevention", () => {
  it("creates one alert per incident no matter how often the generator runs", async () => {
    const id = await newOrder("preparing");
    expect((await run(31 * MIN)).created).toBe(1);
    expect(await run(32 * MIN)).toEqual({ created: 0, reopened: 0, resolved: 0 });
    expect(await run(33 * MIN)).toEqual({ created: 0, reopened: 0, resolved: 0 });
    expect(await alertsFor(id)).toHaveLength(1);
  });

  it("is enforced by the database even if two writers race (unique index)", async () => {
    const id = await newOrder("preparing");
    await run(31 * MIN);
    const [a] = await alertsFor(id);
    await expect(
      q(
        `insert into alerts (type, severity, message, order_id, incident_key) values ('restaurant_delay', 'amber', 'dup', $1, $2)`,
        [id, a!.incident_key],
      ),
    ).rejects.toThrow(/uq_alerts_incident/);
  });

  it("leaves hand-made alerts (no incident_key) untouched", async () => {
    const id = await newOrder("preparing");
    await q(`insert into alerts (type, severity, message, order_id) values ('high_demand', 'blue', 'manual', $1)`, [id]);
    await q(`insert into alerts (type, severity, message, order_id) values ('high_demand', 'blue', 'manual 2', $1)`, [id]);
    expect(await run(0)).toEqual({ created: 0, reopened: 0, resolved: 0 });
    expect((await alertsFor(id)).filter((a) => a.resolved_at === null)).toHaveLength(2);
  });
});

describe("resolution, status transitions and reopening", () => {
  it("auto-resolves when the order moves to the next stage, with resolved_by left null", async () => {
    const id = await newOrder("preparing");
    await run(31 * MIN);
    await setStatus(id, "ready_for_pickup");
    // 2 minutes into ready_for_pickup: well inside its own 5m threshold.
    const res = await run(2 * MIN);
    expect(res).toMatchObject({ resolved: 1, created: 0 });
    const [a] = await alertsFor(id);
    expect(a!.resolved_at).not.toBeNull();
    expect(a!.resolved_by).toBeNull();
  });

  it("auto-resolves when the order is cancelled or delivered", async () => {
    const a = await newOrder("restaurant_notified");
    const b = await newOrder("heading_to_customer");
    await run(40 * MIN);
    await setStatus(a, "cancelled");
    await setStatus(b, "delivered");
    const res = await run(41 * MIN);
    expect(res.resolved).toBeGreaterThanOrEqual(2);
    for (const id of [a, b]) {
      expect((await alertsFor(id)).every((x) => x.resolved_at !== null)).toBe(true);
    }
  });

  it("does not reopen an alert a human resolved, and does not duplicate it", async () => {
    const id = await newOrder("preparing");
    await run(31 * MIN);
    const [a] = await alertsFor(id);
    await q(`update alerts set resolved_at = now(), resolved_by = $2 where id = $1`, [a!.id, staffId]);
    expect(await run(35 * MIN)).toEqual({ created: 0, reopened: 0, resolved: 0 });
    const rows = await alertsFor(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.resolved_by).toBe(staffId);
  });

  it("reopens the same alert when an auto-resolved incident becomes active again", async () => {
    const [rp] = await q<{ id: string }>(`insert into auth.users (email) values ('r2@x.test') returning id`);
    await q(`insert into riders (id) values ($1)`, [rp!.id]);
    const id = await newOrder("ready_for_pickup");
    await run(6 * MIN);
    const [first] = await alertsFor(id);
    // A rider is attached without the status changing -> condition clears.
    await q(`update orders set rider_id = $2 where id = $1`, [id, rp!.id]);
    expect((await run(7 * MIN)).resolved).toBe(1);
    // Rider removed again -> same stage visit, same incident.
    await q(`update orders set rider_id = null where id = $1`, [id]);
    const res = await run(8 * MIN);
    expect(res).toMatchObject({ reopened: 1, created: 0 });
    const rows = await alertsFor(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: first!.id, resolved_at: null });
  });

  it("opens a NEW alert when the order re-enters an overdue stage later", async () => {
    const id = await newOrder("preparing");
    await run(31 * MIN);
    await setStatus(id, "ready_for_pickup");
    await run(32 * MIN);
    // Kitchen sends it back to preparing; that is a fresh stage visit.
    await q(`update order_status_history set changed_at = now() + interval '33 minutes' where order_id = $1 and status = 'ready_for_pickup'`, [id]);
    await setStatus(id, "preparing");
    await q(
      `update order_status_history set changed_at = now() + interval '34 minutes'
        where id = (select max(id) from order_status_history where order_id = $1)`,
      [id],
    );
    const res = await run(70 * MIN);
    expect(res.created).toBe(1);
    const preparing = (await alertsFor(id)).filter((a) => a.incident_key.startsWith("stage:preparing"));
    expect(preparing).toHaveLength(2);
    expect(preparing.filter((a) => a.resolved_at === null)).toHaveLength(1);
  });
});

describe("access control and wiring", () => {
  it("lets staff run the check but not plain customers or anonymous callers", async () => {
    await db.exec(`set role authenticated`);
    await db.exec(`select set_config('request.jwt.claim.sub', '${plainCustomerId}', false)`);
    await expect(q(`select public.generate_operational_alerts()`)).rejects.toThrow(/Only admin or dispatcher/);

    await db.exec(`select set_config('request.jwt.claim.sub', '${staffId}', false)`);
    const [ok] = await q<{ generate_operational_alerts: unknown }>(`select public.generate_operational_alerts()`);
    expect(ok!.generate_operational_alerts).toMatchObject({ created: 0 });

    await db.exec(`select set_config('request.jwt.claim.sub', '', false)`);
    await db.exec(`set role anon`);
    await expect(q(`select public.generate_operational_alerts()`)).rejects.toThrow(/permission denied/);
    await db.exec(`reset role`);
  });

  it("does not expose the time-injectable core generator to API roles", async () => {
    await db.exec(`set role authenticated`);
    await expect(q(`select public._generate_operational_alerts(now())`)).rejects.toThrow(/permission denied/);
    await db.exec(`reset role`);
  });

  it("publishes alerts to supabase_realtime", async () => {
    const rows = await q(`select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'alerts'`);
    expect(rows).toHaveLength(1);
  });

  it("is safe to re-run the migration (idempotent, keeps admin-tuned thresholds)", async () => {
    await q(`update stage_sla_config set alert_after_seconds = 2400 where stage = 'preparing'`);
    const fs = await import("node:fs");
    const path = await import("node:path");
    const sql = fs.readFileSync(path.resolve(__dirname, "../../../../supabase/migrations/0013_automated_operational_alerts.sql"), "utf8");
    await db.exec(sql);
    const [row] = await q<{ alert_after_seconds: number }>(`select alert_after_seconds from stage_sla_config where stage = 'preparing'`);
    expect(row!.alert_after_seconds).toBe(2400);
    await q(`update stage_sla_config set alert_after_seconds = 1800 where stage = 'preparing'`);
  });
});
