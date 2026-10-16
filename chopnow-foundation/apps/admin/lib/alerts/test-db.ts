import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { cube } from "@electric-sql/pglite/contrib/cube";
import { earthdistance } from "@electric-sql/pglite/contrib/earthdistance";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";

/**
 * Boots an in-memory Postgres (PGlite) and applies the project's REAL
 * migrations from supabase/migrations, in order, so tests run against the
 * actual schema rather than a hand-copied one.
 *
 * Only the pieces Supabase provides outside our migrations are stubbed: the
 * anon/authenticated/service_role roles, the `auth` schema (users, uid()),
 * the `extensions` schema (moddatetime), and the supabase_realtime
 * publication. pg_cron isn't available in PGlite; the migration guards for
 * that and just raises a notice.
 */
const MIGRATIONS_DIR = path.resolve(__dirname, "../../../../supabase/migrations");

export interface TestDbOptions {
  /** SQL to run just before the named migration file (e.g. to simulate production drift). */
  beforeMigration?: Record<string, string>;
}

export async function createTestDb(opts: TestDbOptions = {}): Promise<PGlite> {
  const db = new PGlite({ extensions: { cube, earthdistance, uuid_ossp } });
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create schema auth;
    create schema extensions;
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text,
      raw_user_meta_data jsonb default '{}'::jsonb
    );
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function extensions.moddatetime() returns trigger language plpgsql as
      $$ begin new.updated_at = now(); return new; end $$;
    create publication supabase_realtime;
    grant usage on schema public, auth to anon, authenticated, service_role;
    set search_path = public, extensions;
  `);

  for (const file of fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = fs
      .readFileSync(path.join(MIGRATIONS_DIR, file), "utf8")
      // moddatetime is a Supabase-provided contrib extension PGlite lacks;
      // its function is stubbed above.
      .replace(/create extension if not exists moddatetime[^;]*;/i, "");
    try {
      const pre = opts.beforeMigration?.[file];
      if (pre) await db.exec(pre);
      await db.exec(sql);
    } catch (err) {
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    }
  }
  return db;
}
