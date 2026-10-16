import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "./test-db";

/**
 * Runs the real 0012/0013 alert rules against the real schema (see test-db.ts).
 * Time is controlled through the p_now argument of the core generator, so
 * "31 minutes later" doesn't need sleeping. Status changes go through real
 * UPDATEs, so the order_status_history / paid_at triggers do their normal job.
 */
let db: PGlite;
let customerId: string;
let restaurantId: string;
let staffId: string;
let plainCustomerId: string;
let schedulerRowsFromMigration: { severity: string; message: string }[];

const MIN = 60_000;
const SEC = 1_000;
const MIGRATION_0013 = path.resolve(__dirname, "../../../../supabase/migrations/0013_automated_operational_alerts.sql");

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

async function newOrder(status = "new", opts: { riderId?: string | null; paid?: boolean } = {}): Promise<string> {
  const [row] = await q<{ id: string }>(
    `insert into orders (customer_id, restaurant_id, status, rider_id, payment_status, delivery_full_address,
                         delivery_phone, subtotal, delivery_fee, service_fee, total, payment_method)
     values ($1, $2, $3, $4, $5, 'addr', '080', 1000, 200, 50, 1250, 'paystack') returning id`,
    [customerId, restaurantId, status, opts.riderId ?? null, opts.paid ? "paid" : "pending"],
  );
  return row!.id;
}

const setStatus = (orderId: string, status: string) =>
  q(`update orders set status = $2 where id = $1`, [orderId, status]);

/** Exactly what apps/web/app/api/webhooks/paystack/route.ts does on charge.success. */
const paystackWebhook = (orderId: string) =>
  q(`update orders set payment_status = 'paid', status = 'restaurant_notified' where id = $1`, [orderId]);

/** Run the generator as if `afterMs` had passed since now. */
async function run(afterMs = 0) {
  const [row] = await q<{ r: { created: number; reopened: number; resolved: number } }>(
    `select public._generate_operational_alerts(now() + ($1 || ' milliseconds')::interval) as r`,
    [String(afterMs)],
  );
  return row!.r;
}

interface AlertRowT {
  id: string; type: string; severity: string; title: string; message: string;
  resolved_at: string | null; resolved_by: string | null; incident_key: string; resolution_reason: string | null;
}
const alertsFor = (orderId: string) =>
  q<AlertRowT>(
    `select id, type::text, severity, title, message, resolved_at, resolved_by, incident_key, resolution_reason
       from alerts where order_id = $1 order by created_at, id`,
    [orderId],
  );
const activeFor = async (orderId: string) => (await alertsFor(orderId)).filter((a) => a.resolved_at === null);

beforeAll(async () => {
  db = await createTestDb();
  // Captured before any test cleanup: what the migration itself reported when
  // it ran on a database with no pg_cron (PGlite).
  schedulerRowsFromMigration = await q(`select severity, message from activity_log where category = 'system'`);

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

describe("configuration (seeded by 0013)", () => {
  it("has the agreed thresholds, severities and labels, and leaves the SLA values untouched", async () => {
    const rows = await q<{ stage: string; sla_seconds: number; alert_after_seconds: number | null; alert_severity: string; alert_label: string | null }>(
      `select stage::text, sla_seconds, alert_after_seconds, alert_severity, alert_label from stage_sla_config`,
    );
    const by = Object.fromEntries(rows.map((r) => [r.stage, r]));

    const expected: Record<string, [number, string, string]> = {
      new: [120, "red", "Paid order needs immediate attention"],
      restaurant_notified: [300, "amber", "Order needs attention"],
      restaurant_accepted: [300, "amber", "Order needs attention"],
      preparing: [1800, "amber", "Preparation taking longer"],
      ready_for_pickup: [300, "red", "Rider needed"],
      rider_assigned: [600, "amber", "Pickup may be delayed"],
      rider_enroute_restaurant: [900, "amber", "Pickup may be delayed"],
      picked_up: [600, "amber", "Delivery status needs checking"],
      heading_to_customer: [1800, "amber", "Delivery may be delayed"],
    };
    for (const [stage, [secs, sev, label]] of Object.entries(expected)) {
      expect(by[stage], stage).toMatchObject({ alert_after_seconds: secs, alert_severity: sev, alert_label: label });
    }
    expect(by.delivered!.alert_after_seconds).toBeNull();

    // Original SLA values from 0007, unchanged.
    const sla: Record<string, number> = {
      new: 30, payment_confirmed: 20, restaurant_notified: 60, restaurant_accepted: 120, preparing: 900,
      ready_for_pickup: 180, rider_assigned: 90, rider_enroute_restaurant: 300, picked_up: 60,
      heading_to_customer: 600, delivered: 60,
    };
    for (const [stage, secs] of Object.entries(sla)) expect(by[stage]!.sla_seconds, stage).toBe(secs);
  });

  it("refuses an alert threshold below the stage SLA", async () => {
    await expect(
      q(`update stage_sla_config set alert_after_seconds = 10 where stage = 'preparing'`),
    ).rejects.toThrow(/stage_sla_alert_not_before_sla/);
  });
});

describe("stage rules", () => {
  it("does not alert while an order is inside its alert threshold", async () => {
    const id = await newOrder("restaurant_notified");
    expect(await run(4 * MIN)).toEqual({ created: 0, reopened: 0, resolved: 0 });
    expect(await alertsFor(id)).toHaveLength(0);
  });

  it("restaurant stages say the order needs attention, not that the restaurant is slow", async () => {
    const a = await newOrder("restaurant_notified");
    const b = await newOrder("restaurant_accepted");
    await run(6 * MIN);
    for (const id of [a, b]) {
      const [x] = await alertsFor(id);
      expect(x).toMatchObject({ type: "restaurant_delay", severity: "amber", title: "Order needs attention" });
      expect(x!.message).not.toMatch(/restaurant is (slow|late)/i);
    }
  });

  it("does not treat normal preparation time as a delay: 20m is past the 15m SLA but under the 30m threshold", async () => {
    const id = await newOrder("preparing");
    await run(20 * MIN);
    expect(await alertsFor(id)).toHaveLength(0);
  });

  it("raises 'Preparation taking longer' once preparing exceeds 30 minutes", async () => {
    const id = await newOrder("preparing");
    expect((await run(31 * MIN)).created).toBe(1);
    const [a] = await alertsFor(id);
    expect(a).toMatchObject({ type: "restaurant_delay", severity: "amber", title: "Preparation taking longer", resolved_at: null, resolved_by: null });
    expect(a!.message).toMatch(/^CN-\d+ \(Mama Put\) has been in "Preparing" for 31m \(alert threshold 30m\)$/);
    expect(a!.incident_key).toMatch(/^stage:preparing:\d+$/);
  });

  it("raises a red 'Rider needed' for an order awaiting rider assignment after 5 minutes", async () => {
    const id = await newOrder("ready_for_pickup");
    await run(4 * MIN);
    expect(await alertsFor(id)).toHaveLength(0);
    await run(6 * MIN);
    const [a] = await alertsFor(id);
    expect(a).toMatchObject({ type: "no_rider_accepted", severity: "red", title: "Rider needed" });
    expect(a!.message).toContain("with no rider assigned");
  });

  it("does not raise 'Rider needed' when a rider is already on the order", async () => {
    const [rp] = await q<{ id: string }>(`insert into auth.users (email) values ('r@x.test') returning id`);
    await q(`insert into riders (id) values ($1)`, [rp!.id]);
    const id = await newOrder("ready_for_pickup", { riderId: rp!.id });
    await run(10 * MIN);
    expect(await alertsFor(id)).toHaveLength(0);
  });

  it("rider-side stages use their own thresholds and labels", async () => {
    const cases: [string, number, number, string][] = [
      // status, just-under (min), just-over (min), title
      ["rider_assigned", 9, 11, "Pickup may be delayed"],
      ["rider_enroute_restaurant", 14, 16, "Pickup may be delayed"],
      ["picked_up", 9, 11, "Delivery status needs checking"],
      ["heading_to_customer", 29, 31, "Delivery may be delayed"],
    ];
    for (const [status, under, over, title] of cases) {
      const id = await newOrder(status);
      await run(under * MIN);
      expect(await alertsFor(id), `${status} @${under}m`).toHaveLength(0);
      await run(over * MIN);
      const [a] = await alertsFor(id);
      expect(a, `${status} @${over}m`).toMatchObject({ type: "rider_delay", severity: "amber", title });
    }
  });

  it("never alerts on delivered, completed, cancelled or refunded orders, however old", async () => {
    const ids = [];
    for (const s of ["delivered", "completed", "cancelled", "refunded"]) ids.push(await newOrder(s));
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
    try {
      const id = await newOrder("preparing");
      // 40m: past the old 30m threshold but inside the 60m customer window.
      await run(40 * MIN);
      expect(await alertsFor(id)).toHaveLength(0);
    } finally {
      await q(`update stage_sla_config set alert_after_seconds = 1800 where stage = 'preparing'`);
    }
  });
});

describe("paid order stuck in `new`", () => {
  it("records paid_at when payment_status becomes paid", async () => {
    const id = await newOrder("new");
    const [before] = await q<{ paid_at: string | null }>(`select paid_at from orders where id = $1`, [id]);
    expect(before!.paid_at).toBeNull();
    await q(`update orders set payment_status = 'paid' where id = $1`, [id]);
    const [after] = await q<{ paid_at: string | null }>(`select paid_at from orders where id = $1`, [id]);
    expect(after!.paid_at).not.toBeNull();
  });

  it("ignores an unpaid `new` order however long it has sat there (abandoned checkout, cash)", async () => {
    const id = await newOrder("new");
    await run(48 * 60 * MIN);
    expect(await alertsFor(id)).toHaveLength(0);
  });

  it("does not alert in the first 2 minutes after payment, then raises a red, immediate-attention alert", async () => {
    const id = await newOrder("new");
    await q(`update orders set payment_status = 'paid' where id = $1`, [id]);
    await run(119 * SEC);
    expect(await alertsFor(id)).toHaveLength(0);

    expect((await run(121 * SEC)).created).toBe(1);
    const [a] = await alertsFor(id);
    expect(a).toMatchObject({ type: "paid_order_stuck", severity: "red", title: "Paid order needs immediate attention" });
    expect(a!.message).toMatch(/was paid 2m ago but is still "New"/);
  });

  it("resolves automatically once the order moves forward", async () => {
    const id = await newOrder("new");
    await q(`update orders set payment_status = 'paid' where id = $1`, [id]);
    await run(5 * MIN);
    expect(await activeFor(id)).toHaveLength(1);
    await setStatus(id, "restaurant_notified");
    await run(6 * MIN);
    expect((await alertsFor(id)).find((x) => x.type === "paid_order_stuck")!.resolved_at).not.toBeNull();
  });

  it("falls back to the time the order entered `new` for older paid orders with no paid_at", async () => {
    const id = await newOrder("new", { paid: true });
    await q(`update orders set paid_at = null where id = $1`, [id]);
    await run(3 * MIN);
    expect((await alertsFor(id)).map((x) => x.type)).toEqual(["paid_order_stuck"]);
  });

  it("the real webhook (one UPDATE that sets both columns) never leaves an order in paid+new", async () => {
    const id = await newOrder("new");
    await paystackWebhook(id);
    await run(10 * MIN);
    expect((await alertsFor(id)).map((x) => x.type)).not.toContain("paid_order_stuck");
  });
});

describe("undelivered window (the real Paystack path)", () => {
  async function webhookOrder() {
    const id = await newOrder("new");
    await paystackWebhook(id);
    return id;
  }

  it("the webhook never writes a payment_confirmed history row (why the old anchor failed)", async () => {
    const id = await webhookOrder();
    const statuses = (await q<{ status: string }>(`select status::text from order_status_history where order_id = $1 order by id`, [id])).map((r) => r.status);
    expect(statuses).toEqual(["new", "restaurant_notified"]);
  });

  it("raises 'Customer waiting too long' after 60 minutes, not before, for an order that came through the webhook", async () => {
    const id = await webhookOrder();
    await run(59 * MIN);
    expect((await alertsFor(id)).map((a) => a.type)).not.toContain("customer_wait_exceeded");

    await run(61 * MIN);
    const win = (await alertsFor(id)).find((a) => a.type === "customer_wait_exceeded");
    expect(win).toMatchObject({ severity: "red", title: "Customer waiting too long", resolved_at: null });
    expect(win!.message).toMatch(/still undelivered 1h 1m after payment \(limit 1h\)/);
    expect(win!.message).toContain('currently "Restaurant Notified" for 1h 1m');
    expect(win!.incident_key).toMatch(/^window:\d+$/);
  });

  it("is anchored on the first history row after `new`, even when later stages are fresh", async () => {
    const id = await webhookOrder();
    await setStatus(id, "restaurant_accepted");
    await setStatus(id, "preparing");
    await q(
      `update order_status_history set changed_at = now() - interval '61 minutes' where order_id = $1 and status = 'restaurant_notified'`,
      [id],
    );
    await run(0);
    expect((await alertsFor(id)).map((a) => a.type)).toEqual(["customer_wait_exceeded"]);
  });

  it("honours the configurable window", async () => {
    await q(`update platform_settings set value = '600' where key = 'alert_undelivered_window_seconds'`);
    const id = await webhookOrder();
    await run(11 * MIN);
    expect((await alertsFor(id)).map((a) => a.type)).toContain("customer_wait_exceeded");
  });
});

describe("noise control: overlapping alerts for one slow order", () => {
  it("folds the amber stage alert into the customer-waiting alert instead of showing both", async () => {
    const id = await newOrder("new");
    await paystackWebhook(id);
    await setStatus(id, "restaurant_accepted");
    await setStatus(id, "preparing");

    // 31m: only the amber 'Preparation taking longer' exists.
    await run(31 * MIN);
    expect((await activeFor(id)).map((a) => a.title)).toEqual(["Preparation taking longer"]);

    // 61m: the customer-waiting alert takes over; the amber one is superseded.
    const res = await run(61 * MIN);
    expect(res).toMatchObject({ created: 1, resolved: 1 });
    expect((await activeFor(id)).map((a) => a.title)).toEqual(["Customer waiting too long"]);
  });

  it("marks the folded stage alert 'superseded' (not cleared) and says so on the red alert, once", async () => {
    const id = await newOrder("new");
    await paystackWebhook(id);
    await setStatus(id, "restaurant_accepted");
    await setStatus(id, "preparing");
    await run(31 * MIN);
    expect((await alertsFor(id))[0]!.resolution_reason).toBeNull();

    await run(61 * MIN);
    await run(62 * MIN);
    await run(63 * MIN); // reruns must not duplicate the note
    const all = await alertsFor(id);
    const stage = all.find((a) => a.type === "restaurant_delay")!;
    expect(stage).toMatchObject({ resolution_reason: "superseded", resolved_by: null });
    expect(stage.resolved_at).not.toBeNull();

    const win = all.find((a) => a.type === "customer_wait_exceeded")!;
    expect(win.resolved_at).toBeNull();
    expect(win.message).toContain('"Preparation taking longer" alert for this order was folded into this one');
    expect(win.message).toContain("The order is still delayed");
    expect(win.message.match(/folded into this one/g)).toHaveLength(1);
  });

  it("a stage alert that clears because the order moved on is NOT marked superseded", async () => {
    const id = await newOrder("restaurant_notified");
    await run(6 * MIN);
    await setStatus(id, "restaurant_accepted");
    await run(7 * MIN);
    const [a] = await alertsFor(id);
    expect(a!.resolved_at).not.toBeNull();
    expect(a!.resolution_reason).toBeNull();
  });

  it("a red stage alert (Rider needed) is never superseded by the customer-waiting alert", async () => {
    const id = await newOrder("new");
    await paystackWebhook(id);
    await setStatus(id, "ready_for_pickup");
    await run(70 * MIN);
    const rider = (await alertsFor(id)).find((a) => a.type === "no_rider_accepted")!;
    expect(rider.resolved_at).toBeNull();
    expect(rider.resolution_reason).toBeNull();
  });

  it("the red alert carries no folded-note when nothing was folded into it", async () => {
    const id = await newOrder("new");
    await paystackWebhook(id);
    await setStatus(id, "ready_for_pickup");
    await run(70 * MIN);
    const win = (await alertsFor(id)).find((a) => a.type === "customer_wait_exceeded")!;
    expect(win.message).not.toContain("folded into this one");
  });

  it("keeps genuinely different problems separate: 'Rider needed' and 'Customer waiting too long' together", async () => {
    const id = await newOrder("new");
    await paystackWebhook(id);
    await setStatus(id, "ready_for_pickup");
    await run(70 * MIN);
    const active = (await activeFor(id)).map((a) => a.title).sort();
    expect(active).toEqual(["Customer waiting too long", "Rider needed"]);
    // and the window text points at the stage that is stuck
    const win = (await activeFor(id)).find((a) => a.type === "customer_wait_exceeded");
    expect(win!.message).toContain('currently "Ready For Pickup"');
  });

  it("an order has at most one stage alert at a time, however long it sits", async () => {
    const id = await newOrder("restaurant_notified");
    for (const m of [6, 10, 20, 30, 45, 55]) await run(m * MIN);
    expect(await alertsFor(id)).toHaveLength(1);
  });

  it("creates one alert per incident no matter how often the generator runs", async () => {
    const id = await newOrder("preparing");
    expect((await run(31 * MIN)).created).toBe(1);
    for (const m of [32, 33, 40]) expect(await run(m * MIN)).toEqual({ created: 0, reopened: 0, resolved: 0 });
    expect(await alertsFor(id)).toHaveLength(1);
  });

  it("is enforced by the database even if two writers race (unique index)", async () => {
    const id = await newOrder("preparing");
    await run(31 * MIN);
    const [a] = await alertsFor(id);
    await expect(
      q(`insert into alerts (type, severity, message, order_id, incident_key) values ('restaurant_delay', 'amber', 'dup', $1, $2)`, [id, a!.incident_key]),
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

describe("resolution: cancelled, delivered and completed orders", () => {
  it("auto-resolves when the order moves to the next stage, with resolved_by left null", async () => {
    const id = await newOrder("preparing");
    await run(31 * MIN);
    await setStatus(id, "ready_for_pickup");
    const res = await run(2 * MIN);
    expect(res).toMatchObject({ resolved: 1, created: 0 });
    const [a] = await alertsFor(id);
    expect(a!.resolved_at).not.toBeNull();
    expect(a!.resolved_by).toBeNull();
  });

  it("cancelling resolves every active alert on the order, including the customer-waiting one", async () => {
    const a = await newOrder("preparing");
    const b = await newOrder("ready_for_pickup");
    const c = await newOrder("new");
    await paystackWebhook(c);
    await setStatus(c, "ready_for_pickup");
    await run(70 * MIN);
    expect((await activeFor(c)).length).toBe(2);

    for (const id of [a, b, c]) {
      await q(`update orders set status = 'cancelled', cancelled_reason = 'Cancelled by admin' where id = $1`, [id]);
    }
    await run(71 * MIN);
    for (const id of [a, b, c]) expect(await activeFor(id), id).toHaveLength(0);
    expect((await q(`select count(*)::int n from alerts where resolved_at is null`))[0]).toEqual({ n: 0 });
  });

  it("delivered and completed orders stop producing alerts and keep none active", async () => {
    const d = await newOrder("heading_to_customer");
    const e = await newOrder("picked_up");
    await run(40 * MIN);
    expect((await activeFor(d)).length + (await activeFor(e)).length).toBeGreaterThan(0);

    await setStatus(d, "delivered");
    await setStatus(e, "delivered");
    await setStatus(e, "completed");
    await run(41 * MIN);
    expect(await activeFor(d)).toHaveLength(0);
    expect(await activeFor(e)).toHaveLength(0);
    // eight hours later: still nothing new for any terminal order
    expect(await run(8 * 60 * MIN)).toEqual({ created: 0, reopened: 0, resolved: 0 });
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
    await q(`update orders set rider_id = $2 where id = $1`, [id, rp!.id]);
    expect((await run(7 * MIN)).resolved).toBe(1);
    await q(`update orders set rider_id = null where id = $1`, [id]);
    const res = await run(8 * MIN);
    expect(res).toMatchObject({ reopened: 1, created: 0 });
    const rows = await alertsFor(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: first!.id, resolved_at: null });
  });

  it("opens a NEW alert when the order re-enters an overdue stage later", async () => {
    // Widen the customer window so the amber stage alert isn't folded into it.
    await q(`update platform_settings set value = '14400' where key = 'alert_undelivered_window_seconds'`);
    const id = await newOrder("preparing");
    await run(31 * MIN);
    await setStatus(id, "ready_for_pickup");
    await run(32 * MIN);
    await q(`update order_status_history set changed_at = now() + interval '33 minutes' where order_id = $1 and status = 'ready_for_pickup'`, [id]);
    await setStatus(id, "preparing");
    await q(
      `update order_status_history set changed_at = now() + interval '34 minutes'
        where id = (select max(id) from order_status_history where order_id = $1)`,
      [id],
    );
    const res = await run(70 * MIN);
    expect(res.created).toBeGreaterThanOrEqual(1);
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
    await expect(q(`select public.operational_alerts_scheduler_status()`)).rejects.toThrow(/Only admin or dispatcher/);

    await db.exec(`select set_config('request.jwt.claim.sub', '${staffId}', false)`);
    const [ok] = await q<{ generate_operational_alerts: unknown }>(`select public.generate_operational_alerts()`);
    expect(ok!.generate_operational_alerts).toMatchObject({ created: 0 });

    await db.exec(`select set_config('request.jwt.claim.sub', '', false)`);
    await db.exec(`set role anon`);
    await expect(q(`select public.generate_operational_alerts()`)).rejects.toThrow(/permission denied/);
    await db.exec(`reset role`);
  });

  it("does not expose the time-injectable core generator or the scheduler installer to API roles", async () => {
    await db.exec(`set role authenticated`);
    await expect(q(`select public._generate_operational_alerts(now())`)).rejects.toThrow(/permission denied/);
    await expect(q(`select public._schedule_operational_alerts_job()`)).rejects.toThrow(/permission denied/);
    await db.exec(`reset role`);
  });

  it("publishes alerts to supabase_realtime", async () => {
    const rows = await q(`select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'alerts'`);
    expect(rows).toHaveLength(1);
  });
});

describe("pg_cron scheduling is resilient and honest", () => {
  const STUB_OK = `
    create schema cron;
    create table cron.job (jobid bigserial primary key, jobname text, schedule text, command text, active boolean not null default true);
    create table cron.job_run_details (runid bigserial primary key, jobid bigint, status text, return_message text, start_time timestamptz);
    create function cron.schedule(p_name text, p_schedule text, p_command text) returns bigint language sql as
      $$ insert into cron.job (jobname, schedule, command) values (p_name, p_schedule, p_command) returning jobid $$;
    create function cron.unschedule(p_name text) returns boolean language sql as
      $$ with d as (delete from cron.job where jobname = p_name returning 1) select exists (select 1 from d) $$;
  `;
  const STUB_FAILING_SCHEDULE = `
    create or replace function cron.schedule(p_name text, p_schedule text, p_command text) returns bigint language plpgsql as
      $$ begin raise exception 'permission denied for table job' using errcode = '42501'; end $$;
  `;

  afterAll(async () => {
    await db.exec(`drop schema if exists cron cascade`);
  });

  it("the migration itself reported clearly that automation was NOT enabled when pg_cron is unavailable", () => {
    // PGlite has no pg_cron: the migration must have completed, and said so loudly.
    expect(schedulerRowsFromMigration).toHaveLength(1);
    expect(schedulerRowsFromMigration[0]).toMatchObject({ severity: "red" });
    expect(schedulerRowsFromMigration[0]!.message).toMatch(/NOT running.*pg_cron is not available/s);
    expect(schedulerRowsFromMigration[0]!.message).not.toMatch(/enabled/i);
  });

  it("scheduler status says not running, with a reason, when there is no cron job", async () => {
    const [r] = await q<{ s: { running: boolean; reason: string } }>(`select public.operational_alerts_scheduler_status() s`);
    expect(r!.s).toMatchObject({ running: false, reason: "pg_cron is not installed" });
  });

  it("schedules the job and reports success when pg_cron works", async () => {
    await db.exec(STUB_OK);
    const [r] = await q<{ r: { scheduled: boolean } }>(`select public._schedule_operational_alerts_job() r`);
    expect(r!.r.scheduled).toBe(true);
    const jobs = await q<{ schedule: string; command: string }>(`select schedule, command from cron.job where jobname = 'chopnow-generate-operational-alerts'`);
    expect(jobs).toEqual([{ schedule: "* * * * *", command: "select public.generate_operational_alerts()" }]);
    // re-scheduling replaces rather than duplicates
    await q(`select public._schedule_operational_alerts_job()`);
    expect((await q(`select 1 from cron.job where jobname = 'chopnow-generate-operational-alerts'`))).toHaveLength(1);
  });

  it("status distinguishes never-run, failed, stale, paused and healthy", async () => {
    const status = async () => (await q<{ s: { running: boolean; reason?: string } }>(`select public.operational_alerts_scheduler_status() s`))[0]!.s;
    const [{ jobid }] = await q<{ jobid: number }>(`select jobid from cron.job where jobname = 'chopnow-generate-operational-alerts'`) as [{ jobid: number }];

    expect(await status()).toMatchObject({ running: false, reason: expect.stringMatching(/has not run yet/) });

    await q(`insert into cron.job_run_details (jobid, status, start_time) values ($1, 'failed', now())`, [jobid]);
    expect(await status()).toMatchObject({ running: false, reason: expect.stringMatching(/last run failed/) });

    await q(`delete from cron.job_run_details`);
    await q(`insert into cron.job_run_details (jobid, status, start_time) values ($1, 'succeeded', now() - interval '10 minutes')`, [jobid]);
    expect(await status()).toMatchObject({ running: false, reason: expect.stringMatching(/more than 3 minutes ago/) });

    await q(`delete from cron.job_run_details`);
    await q(`insert into cron.job_run_details (jobid, status, start_time) values ($1, 'succeeded', now() - interval '30 seconds')`, [jobid]);
    expect(await status()).toMatchObject({ running: true });

    await q(`update cron.job set active = false where jobid = $1`, [jobid]);
    expect(await status()).toMatchObject({ running: false, reason: "the pg_cron job is paused" });
    await q(`update cron.job set active = true where jobid = $1`, [jobid]);
  });

  it("a scheduling failure is caught: the migration still applies in full and records a red 'NOT running' entry", async () => {
    await db.exec(STUB_FAILING_SCHEDULE);
    await q(`delete from activity_log`);

    // Re-apply the entire migration while cron.schedule() raises.
    await expect(db.exec(fs.readFileSync(MIGRATION_0013, "utf8"))).resolves.toBeDefined();

    const rows = await q<{ severity: string; message: string }>(`select severity, message from activity_log where category = 'system'`);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ severity: "red" });
    expect(rows[0]!.message).toMatch(/NOT running.*permission denied for table job/s);

    // ...and the rest of the migration is intact and working.
    const id = await newOrder("preparing");
    expect((await run(31 * MIN)).created).toBe(1);
    expect(await alertsFor(id)).toHaveLength(1);
  });

  it("is safe to re-run the migration (idempotent, keeps admin-tuned thresholds and labels)", async () => {
    await q(`update stage_sla_config set alert_after_seconds = 2400, alert_label = 'Custom' where stage = 'preparing'`);
    await db.exec(fs.readFileSync(MIGRATION_0013, "utf8"));
    const [row] = await q<{ alert_after_seconds: number; alert_label: string }>(`select alert_after_seconds, alert_label from stage_sla_config where stage = 'preparing'`);
    expect(row).toEqual({ alert_after_seconds: 2400, alert_label: "Custom" });
    await q(`update stage_sla_config set alert_after_seconds = 1800, alert_label = 'Preparation taking longer' where stage = 'preparing'`);
  });
});
