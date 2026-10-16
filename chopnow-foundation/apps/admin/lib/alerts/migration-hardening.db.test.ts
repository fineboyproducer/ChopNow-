import { afterAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "./test-db";

/**
 * Failure-path checks for migration 0013 that need a database set up
 * differently BEFORE 0013 runs (production drift), so each boots its own copy.
 */
const F13 = "0013_automated_operational_alerts.sql";
const dbs: PGlite[] = [];
afterAll(async () => {
  await Promise.all(dbs.map((d) => d.close()));
});

describe("0013 seed is safe when production SLAs differ from the defaults", () => {
  it("applies cleanly, clamps thresholds up to the stage SLA, and leaves SLA values unchanged", async () => {
    const db = await createTestDb({
      beforeMigration: {
        // preparing SLA raised above the 1800s default threshold; ready_for_pickup above 300s
        [F13]: `update stage_sla_config set sla_seconds = 5000 where stage = 'preparing';
                update stage_sla_config set sla_seconds = 400 where stage = 'ready_for_pickup';`,
      },
    });
    dbs.push(db);
    const { rows } = await db.query<{ stage: string; sla_seconds: number; alert_after_seconds: number }>(
      `select stage::text, sla_seconds, alert_after_seconds from stage_sla_config
        where stage in ('preparing', 'ready_for_pickup', 'restaurant_notified')`,
    );
    const by = Object.fromEntries(rows.map((r) => [r.stage, r]));
    expect(by.preparing).toMatchObject({ sla_seconds: 5000, alert_after_seconds: 5000 });
    expect(by.ready_for_pickup).toMatchObject({ sla_seconds: 400, alert_after_seconds: 400 });
    // untouched stage keeps the agreed threshold
    expect(by.restaurant_notified).toMatchObject({ sla_seconds: 60, alert_after_seconds: 300 });
    // and the constraint still holds for every row
    const bad = await db.query(`select 1 from stage_sla_config where alert_after_seconds < sla_seconds`);
    expect(bad.rows).toHaveLength(0);
  }, 120_000);
});

describe("0013 realtime step cannot abort the migration", () => {
  it("completes, warns via activity_log, and everything else is still installed when the publication step errors", async () => {
    const db = await createTestDb({
      beforeMigration: {
        [F13]: `
          create function public._block_pub_ddl() returns event_trigger language plpgsql as
            $$ begin raise exception 'simulated publication failure' using errcode = '42501'; end $$;
          create event trigger block_pub_ddl on ddl_command_start
            when tag in ('ALTER PUBLICATION') execute function public._block_pub_ddl();`,
      },
    });
    dbs.push(db);
    // Migration finished (createTestDb throws otherwise). The failure is reported, not silent:
    const log = await db.query<{ severity: string; message: string }>(
      `select severity, message from activity_log where message like 'Alerts live updates are NOT enabled%'`,
    );
    expect(log.rows).toHaveLength(1);
    expect(log.rows[0]!.severity).toBe("red");
    expect(log.rows[0]!.message).toMatch(/simulated publication failure/);
    // alerts is NOT in the publication ...
    const pub = await db.query(`select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'alerts'`);
    expect(pub.rows).toHaveLength(0);
    // ... but the rest of 0013 (including the scheduler step after it) was applied.
    const fn = await db.query(`select 1 from pg_proc where proname = 'generate_operational_alerts'`);
    expect(fn.rows).toHaveLength(1);
    const sched = await db.query(`select 1 from activity_log where message like 'Automatic operational alerts are NOT running%'`);
    expect(sched.rows).toHaveLength(1);

    // documented repair works once the blocker is gone
    await db.exec(`drop event trigger block_pub_ddl`);
    await db.exec(`alter publication supabase_realtime add table public.alerts`);
    const fixed = await db.query(`select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'alerts'`);
    expect(fixed.rows).toHaveLength(1);
  }, 120_000);
});
