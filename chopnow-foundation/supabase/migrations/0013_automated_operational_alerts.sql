-- ============================================================================
-- 0013_automated_operational_alerts.sql
--
-- Server-side generation of operational alerts. Before this migration nothing
-- in the system ever inserted into `alerts` (no trigger, cron job or edge
-- function), so the Alerts page was always empty.
--
-- ORDER: run 0012_add_alert_types_for_automated_alerts.sql first, as its own
-- statement/transaction, then this file.
--
-- What this adds
--   1. Per-stage alert config on stage_sla_config (admin-editable):
--        alert_after_seconds  NULL = no alert for this stage
--        alert_severity       red | amber | blue
--        alert_label          the alert's headline
--      The alert threshold is separate from, and never lower than, the stage's
--      SLA (sla_seconds). The SLA still drives the "Delayed" badge in the
--      pipeline; the alert threshold is when ops gets alerted. SLA values are
--      NOT modified here.
--   2. platform_settings.alert_undelivered_window_seconds (default 3600).
--   3. orders.paid_at (set by trigger when payment_status becomes 'paid'), so
--      "paid for more than 2 minutes" can be measured. Not backfilled.
--   4. alerts.title + alerts.incident_key and a unique index: one incident is
--      one alert.
--   5. public.overdue_order_incidents(now)  - the rules, as a query
--      public.generate_operational_alerts() - creates / resolves / reopens
--      public.operational_alerts_scheduler_status() - is the job really there?
--   6. alerts added to the supabase_realtime publication (guarded).
--   7. An attempt to schedule the generator every minute with pg_cron. THIS
--      STEP CAN FAIL WITHOUT ROLLING BACK THE REST OF THE MIGRATION. If it
--      does, automatic alerts are OFF until you schedule the job by hand; see
--      "IF SCHEDULING FAILED" at the bottom.
--
-- Nothing here deletes data, touches RLS, or disables anything.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Per-stage alert config on stage_sla_config
--    Seeded once, only when the columns are first added, so re-running this
--    migration never overwrites thresholds an admin has since changed.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'stage_sla_config' and column_name = 'alert_after_seconds'
  ) then
    alter table stage_sla_config
      add column alert_after_seconds integer
        check (alert_after_seconds is null or alert_after_seconds > 0),
      add column alert_severity text not null default 'amber'
        check (alert_severity in ('red', 'amber', 'blue')),
      add column alert_label text,
      add constraint stage_sla_alert_not_before_sla
        check (alert_after_seconds is null or alert_after_seconds >= sla_seconds);

    -- Defaults. Labels describe the action needed, not who is at fault: there
    -- is no restaurant app, so a restaurant stage only moves when ops acts.
    --  stage                     after  severity  label
    --  new (paid only)           2m     red       Paid order needs immediate attention
    --  payment_confirmed         5m     amber     Order needs attention
    --  restaurant_notified       5m     amber     Order needs attention
    --  restaurant_accepted       5m     amber     Order needs attention
    --  preparing                 30m    amber     Preparation taking longer
    --  ready_for_pickup (no rider) 5m   red       Rider needed
    --  rider_assigned            10m    amber     Pickup may be delayed
    --  rider_enroute_restaurant  15m    amber     Pickup may be delayed
    --  picked_up                 10m    amber     Delivery status needs checking
    --  heading_to_customer       30m    amber     Delivery may be delayed
    --  delivered                 off
    -- greatest(): never below the stage's own sla_seconds, so the
    -- stage_sla_alert_not_before_sla constraint holds even if production SLAs
    -- were edited above the seeded alert thresholds. sla_seconds is not changed.
    update stage_sla_config set alert_after_seconds = greatest(v.secs, sla_seconds), alert_severity = v.sev, alert_label = v.label
    from (values
      ('new',                       120, 'red',   'Paid order needs immediate attention'),
      ('payment_confirmed',         300, 'amber', 'Order needs attention'),
      ('restaurant_notified',       300, 'amber', 'Order needs attention'),
      ('restaurant_accepted',       300, 'amber', 'Order needs attention'),
      ('preparing',                1800, 'amber', 'Preparation taking longer'),
      ('ready_for_pickup',          300, 'red',   'Rider needed'),
      ('rider_assigned',            600, 'amber', 'Pickup may be delayed'),
      ('rider_enroute_restaurant',  900, 'amber', 'Pickup may be delayed'),
      ('picked_up',                 600, 'amber', 'Delivery status needs checking'),
      ('heading_to_customer',      1800, 'amber', 'Delivery may be delayed')
    ) as v(stage, secs, sev, label)
    where stage_sla_config.stage = v.stage::order_status;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2. Undelivered window (seconds after the order left `new`). 3600 = 60 min.
-- ----------------------------------------------------------------------------
insert into platform_settings (key, value)
values ('alert_undelivered_window_seconds', '3600')
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- 3. orders.paid_at: when payment_status first became 'paid'.
--    Existing rows are left NULL (history is not invented); the alert rule
--    falls back to the time the order entered its current status.
-- ----------------------------------------------------------------------------
alter table orders add column if not exists paid_at timestamptz;

create or replace function public.set_paid_at()
returns trigger
language plpgsql
as $$
begin
  if new.payment_status = 'paid'
     and (tg_op = 'INSERT' or old.payment_status is distinct from 'paid')
     and new.paid_at is null then
    new.paid_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_paid_at on orders;
create trigger trg_set_paid_at
  before insert or update of payment_status on orders
  for each row execute procedure public.set_paid_at();

-- ----------------------------------------------------------------------------
-- 4. One incident = one alert
--    incident_key identifies a single occurrence of a condition, e.g.
--    'stage:preparing:1760400000' (the order entered `preparing` at that epoch)
--    or 'window:1760399000'. NULL for hand-made alerts, which this machinery
--    never touches. title is the headline shown in the UI.
-- ----------------------------------------------------------------------------
alter table alerts add column if not exists incident_key text;
alter table alerts add column if not exists title text;

-- Why an auto-resolved alert was closed. 'superseded' = the incident is NOT
-- over: it was folded into the red "Customer waiting too long" alert for the
-- same order. NULL for everything else (staff-resolved, or really cleared).
alter table alerts add column if not exists resolution_reason text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'alerts_resolution_reason_check') then
    alter table alerts add constraint alerts_resolution_reason_check
      check (resolution_reason is null or resolution_reason = 'superseded');
  end if;
end $$;

create unique index if not exists uq_alerts_incident
  on alerts (order_id, type, incident_key)
  where incident_key is not null;

create index if not exists idx_alerts_order on alerts (order_id);

-- ----------------------------------------------------------------------------
-- Helper: 1800 -> '30m', 5400 -> '1h 30m', 45 -> '45s'
-- ----------------------------------------------------------------------------
create or replace function public.format_duration_short(p_seconds numeric)
returns text
language sql
immutable
as $$
  select case
    when p_seconds < 60 then floor(p_seconds)::int || 's'
    when p_seconds < 3600 then floor(p_seconds / 60)::int || 'm'
    when floor(p_seconds / 60)::int % 60 = 0 then floor(p_seconds / 3600)::int || 'h'
    else floor(p_seconds / 3600)::int || 'h ' || (floor(p_seconds / 60)::int % 60) || 'm'
  end;
$$;

-- ----------------------------------------------------------------------------
-- 5a. The rules. Returns every incident that is active as of p_now.
--
-- Only orders still in flight are considered: completed / cancelled / refunded
-- / delivered never alert. Stage entry time is the latest order_status_history
-- row, trusted only when its status matches orders.status; orders without such
-- a row are skipped rather than guessed at.
--
--   stage incident   time in current stage > stage_sla_config.alert_after_seconds
--       new (only if payment_status = 'paid')   -> paid_order_stuck
--           measured from orders.paid_at (falls back to entering `new`)
--       payment_confirmed..preparing            -> restaurant_delay
--       ready_for_pickup AND no rider           -> no_rider_accepted
--       rider_assigned..heading_to_customer     -> rider_delay
--   window incident  the order left `new` more than
--       alert_undelivered_window_seconds ago and is still undelivered
--       -> customer_wait_exceeded. Anchored on the FIRST history row after
--       `new`, because the Paystack webhook moves an order straight from `new`
--       to `restaurant_notified`; a `payment_confirmed` row is never written.
--
-- Noise control: an order has one current stage, so at most one stage incident
-- at a time. When the window incident is active, non-red stage incidents are
-- folded into it (the window alert's text names the current stage and how long
-- it has been there). Red stage incidents ("Rider needed", paid-but-stuck)
-- stay, because they are a different, actionable problem from "the customer has
-- waited too long".
-- ----------------------------------------------------------------------------
create or replace function public.overdue_order_incidents(p_now timestamptz default now())
returns table (
  order_id uuid,
  restaurant_id uuid,
  rider_id uuid,
  alert_type text,
  incident_key text,
  severity text,
  title text,
  message text
)
language sql
stable
set search_path = public
as $$
  with live as (
    select o.id, o.order_number, o.status, o.restaurant_id, o.rider_id, o.payment_status, o.paid_at,
           r.name as restaurant_name
    from orders o
    join restaurants r on r.id = o.restaurant_id
    where o.status not in ('delivered', 'completed', 'cancelled', 'refunded')
  ),
  cur as (
    select distinct on (h.order_id) h.order_id, h.status, h.changed_at
    from order_status_history h
    where h.order_id in (select id from live)
    order by h.order_id, h.changed_at desc, h.id desc
  ),
  left_new as (
    select h.order_id, min(h.changed_at) as left_new_at
    from order_status_history h
    where h.status <> 'new' and h.order_id in (select id from live)
    group by h.order_id
  ),
  window_incidents as (
    select
      l.id as order_id, l.restaurant_id, l.rider_id,
      'customer_wait_exceeded'::text as alert_type,
      ('window:' || floor(extract(epoch from p.left_new_at))::bigint)::text as incident_key,
      'red'::text as severity,
      'Customer waiting too long'::text as title,
      (l.order_number || ' (' || l.restaurant_name || ') is still undelivered '
        || public.format_duration_short(extract(epoch from (p_now - p.left_new_at)))
        || ' after payment (limit ' || public.format_duration_short(w.secs) || ')'
        || case when c.status = l.status
             then '; currently "' || initcap(replace(l.status::text, '_', ' ')) || '" for '
                  || public.format_duration_short(extract(epoch from (p_now - c.changed_at)))
             else '' end)::text as message
    from live l
    join left_new p on p.order_id = l.id
    left join cur c on c.order_id = l.id
    cross join (
      select coalesce(
        (select (value #>> '{}')::numeric from platform_settings where key = 'alert_undelivered_window_seconds'),
        3600
      ) as secs
    ) w
    where l.status <> 'new'
      and extract(epoch from (p_now - p.left_new_at)) > w.secs
  ),
  stage_incidents as (
    select
      l.id as order_id, l.restaurant_id, l.rider_id,
      (case
        when l.status = 'new' then 'paid_order_stuck'
        when l.status in ('payment_confirmed', 'restaurant_notified', 'restaurant_accepted', 'preparing')
          then 'restaurant_delay'
        when l.status = 'ready_for_pickup' then 'no_rider_accepted'
        else 'rider_delay'
      end)::text as alert_type,
      ('stage:' || l.status || ':' || floor(extract(epoch from c.changed_at))::bigint)::text as incident_key,
      s.alert_severity::text as severity,
      coalesce(s.alert_label, initcap(replace(l.status::text, '_', ' ')) || ' taking longer')::text as title,
      (case
        when l.status = 'new' then
          l.order_number || ' (' || l.restaurant_name || ') was paid '
            || public.format_duration_short(extract(epoch from (p_now - coalesce(l.paid_at, c.changed_at))))
            || ' ago but is still "New"; the payment confirmation did not move it forward'
        else
          l.order_number || ' (' || l.restaurant_name || ') has been in "'
            || initcap(replace(l.status::text, '_', ' ')) || '" for '
            || public.format_duration_short(extract(epoch from (p_now - c.changed_at)))
            || ' (alert threshold ' || public.format_duration_short(s.alert_after_seconds) || ')'
            || case when l.status = 'ready_for_pickup' then ' with no rider assigned' else '' end
      end)::text as message
    from live l
    join cur c on c.order_id = l.id and c.status = l.status
    join stage_sla_config s on s.stage = l.status
    where s.alert_after_seconds is not null
      and extract(epoch from (p_now - case when l.status = 'new' then coalesce(l.paid_at, c.changed_at) else c.changed_at end))
          > s.alert_after_seconds
      and (l.status <> 'new' or l.payment_status = 'paid')
      and (l.status <> 'ready_for_pickup' or l.rider_id is null)
      and (s.alert_severity = 'red' or not exists (select 1 from window_incidents wi where wi.order_id = l.id))
  )
  select * from stage_incidents
  union all
  select * from window_incidents;
$$;

-- ----------------------------------------------------------------------------
-- 5b. The generator (core). Idempotent: safe to run as often as you like.
--
--   create  an alert for each active incident that has none
--   reopen  an alert that this system auto-resolved if its incident is active
--           again (an alert a human resolved, resolved_by is set, stays closed)
--   resolve alerts whose incident is no longer active (order advanced, was
--           cancelled/delivered, a rider got assigned, superseded by the
--           customer-waiting alert...). resolved_by stays NULL, which is how
--           "auto-resolved" is told apart from a human.
--
-- Takes p_now so tests can control time; it is not exposed to API roles.
-- ----------------------------------------------------------------------------
create or replace function public._generate_operational_alerts(p_now timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resolved integer;
  v_created integer;
  v_reopened integer;
begin
  create temp table _incidents on commit drop as
    select * from public.overdue_order_incidents(p_now);

  update alerts a
     set resolved_at = p_now,
         -- A stage alert that disappears while the order's customer-waiting
         -- incident is active was folded into it: the delay is NOT resolved.
         resolution_reason = case
           when a.type in ('restaurant_delay', 'rider_delay')
                and exists (select 1 from _incidents w
                            where w.order_id = a.order_id and w.alert_type = 'customer_wait_exceeded')
           then 'superseded' else null end
   where a.resolved_at is null
     and a.incident_key is not null
     and not exists (
       select 1 from _incidents i
       where i.order_id = a.order_id
         and i.alert_type = a.type::text
         and i.incident_key = a.incident_key
     );
  get diagnostics v_resolved = row_count;

  with upserted as (
    insert into alerts (type, severity, title, message, order_id, restaurant_id, rider_id, incident_key, created_at)
    select i.alert_type::alert_type, i.severity, i.title, i.message, i.order_id, i.restaurant_id, i.rider_id, i.incident_key, p_now
    from _incidents i
    on conflict (order_id, type, incident_key) where incident_key is not null
    do update set resolved_at = null, resolution_reason = null, title = excluded.title, message = excluded.message, severity = excluded.severity
      where alerts.resolved_at is not null and alerts.resolved_by is null
    returning (xmax = 0) as inserted
  )
  select count(*) filter (where inserted), count(*) filter (where not inserted)
    into v_created, v_reopened
    from upserted;

  -- Tell staff, on the red alert itself, that a stage alert was folded into it.
  -- Idempotent: the marker phrase is only appended once.
  update alerts w
     set message = w.message || ' Note: the "' || f.titles
                   || '" alert for this order was folded into this one. The order is still delayed.'
    from (
      select s.order_id, string_agg(distinct s.title, '", "') as titles
      from alerts s
      where s.resolution_reason = 'superseded' and s.resolved_at is not null
      group by s.order_id
    ) f
   where w.order_id = f.order_id
     and w.type = 'customer_wait_exceeded'
     and w.resolved_at is null
     and w.message not like '%folded into this one%';

  drop table _incidents;

  return jsonb_build_object('created', v_created, 'reopened', v_reopened, 'resolved', v_resolved);
end;
$$;

-- ----------------------------------------------------------------------------
-- 5c. Public entry point: no arguments, always "now".
--     Called by pg_cron (no JWT) and by the admin app's "Check now" button
--     (signed-in staff only).
-- ----------------------------------------------------------------------------
create or replace function public.generate_operational_alerts()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  -- pg_cron and service_role have no JWT (auth.uid() is null). Any signed-in
  -- API caller must be admin/dispatcher.
  if auth.uid() is not null and not public.is_staff() then
    raise exception 'Only admin or dispatcher accounts can run the alert check'
      using errcode = '42501';
  end if;
  return public._generate_operational_alerts(now());
end;
$$;

-- ----------------------------------------------------------------------------
-- 5d. Is automatic generation really running? Staff only.
--     running = job exists, is active, AND its latest run succeeded within the
--     last 3 minutes. Anything else is reported as not running, with a reason.
-- ----------------------------------------------------------------------------
create or replace function public.operational_alerts_scheduler_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job record;
  v_run record;
begin
  if auth.uid() is not null and not public.is_staff() then
    raise exception 'Only admin or dispatcher accounts can read the scheduler status'
      using errcode = '42501';
  end if;

  if to_regnamespace('cron') is null then
    return jsonb_build_object('running', false, 'reason', 'pg_cron is not installed');
  end if;

  begin
    execute $q$select jobid, active, schedule from cron.job where jobname = 'chopnow-generate-operational-alerts'$q$
      into v_job;
    if v_job.jobid is null then
      return jsonb_build_object('running', false, 'reason', 'the pg_cron job does not exist');
    end if;
    if not v_job.active then
      return jsonb_build_object('running', false, 'reason', 'the pg_cron job is paused');
    end if;
    execute $q$select status, start_time from cron.job_run_details where jobid = $1 order by start_time desc limit 1$q$
      into v_run using v_job.jobid;
    if v_run.start_time is null then
      return jsonb_build_object('running', false, 'reason', 'the job exists but has not run yet', 'schedule', v_job.schedule);
    end if;
    if v_run.status <> 'succeeded' then
      return jsonb_build_object('running', false, 'reason', 'the last run ' || v_run.status, 'last_run_at', v_run.start_time);
    end if;
    if v_run.start_time < now() - interval '3 minutes' then
      return jsonb_build_object('running', false, 'reason', 'the last successful run was more than 3 minutes ago', 'last_run_at', v_run.start_time);
    end if;
    return jsonb_build_object('running', true, 'schedule', v_job.schedule, 'last_run_at', v_run.start_time);
  exception when others then
    return jsonb_build_object('running', false, 'reason', 'could not read pg_cron: ' || sqlerrm);
  end;
end;
$$;

revoke all on function public._generate_operational_alerts(timestamptz) from public, anon, authenticated;
revoke all on function public.generate_operational_alerts() from public, anon;
grant execute on function public.generate_operational_alerts() to authenticated, service_role;
revoke all on function public.operational_alerts_scheduler_status() from public, anon;
grant execute on function public.operational_alerts_scheduler_status() to authenticated, service_role;
revoke all on function public.overdue_order_incidents(timestamptz) from public, anon;
grant execute on function public.overdue_order_incidents(timestamptz) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. Realtime: make sure alerts is in the supabase_realtime publication so the
--    Alerts page's live subscription actually receives rows. No earlier
--    migration did this (it may have been switched on in the dashboard), so it
--    is guarded and does nothing when already present.
-- ----------------------------------------------------------------------------
do $$
begin
  begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'alerts'
       ) then
      alter publication supabase_realtime add table public.alerts;
    end if;
  exception when others then
    -- Never abort the migration over Realtime. Alerts still work; the page
    -- just won't update live until the publication is fixed (see "IF THE
    -- REALTIME STEP FAILED" at the bottom of this file).
    raise warning 'ChopNow alerts: could not add alerts to supabase_realtime (%: %). The rest of this migration was applied; live updates on the Alerts page are NOT enabled until it is fixed by hand.', sqlstate, sqlerrm;
    insert into activity_log (category, severity, message)
    values ('system', 'red', 'Alerts live updates are NOT enabled: could not add the alerts table to the supabase_realtime publication (' || sqlstate || ': ' || sqlerrm || '). The Alerts page needs a refresh to show new alerts until this is repaired.');
  end;
end $$;

-- ----------------------------------------------------------------------------
-- 7. Schedule the generator every minute with pg_cron.
--
-- Wrapped so that ANY failure here (extension unavailable, no privilege to
-- create it, cron.schedule erroring) is caught inside a sub-transaction and
-- cannot roll back the rest of this migration. The outcome is never silent:
--   * a NOTICE / WARNING is raised,
--   * a row is written to activity_log (category 'system'), so it shows in the
--     dashboard's live activity feed, green when scheduled, red when not,
--   * public.operational_alerts_scheduler_status() reports it at any time.
-- Automatic alerts are only ON if the green message appears.
-- ----------------------------------------------------------------------------
create or replace function public._schedule_operational_alerts_job()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if to_regnamespace('cron') is null then
      if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
        create extension if not exists pg_cron;
      else
        return jsonb_build_object('scheduled', false, 'detail', 'pg_cron is not available on this database');
      end if;
    end if;

    if exists (select 1 from cron.job where jobname = 'chopnow-generate-operational-alerts') then
      perform cron.unschedule('chopnow-generate-operational-alerts');
    end if;
    perform cron.schedule(
      'chopnow-generate-operational-alerts',
      '* * * * *',
      'select public.generate_operational_alerts()'
    );

    if not exists (select 1 from cron.job where jobname = 'chopnow-generate-operational-alerts' and active) then
      return jsonb_build_object('scheduled', false, 'detail', 'cron.schedule returned but the job is not present and active');
    end if;
    return jsonb_build_object('scheduled', true, 'detail', 'job chopnow-generate-operational-alerts runs every minute');
  exception when others then
    return jsonb_build_object('scheduled', false, 'detail', sqlstate || ': ' || sqlerrm);
  end;
end;
$$;

revoke all on function public._schedule_operational_alerts_job() from public, anon, authenticated;

do $$
declare
  v_result jsonb;
begin
  v_result := public._schedule_operational_alerts_job();

  if (v_result ->> 'scheduled')::boolean then
    raise notice 'ChopNow alerts: automatic generation is ON (%).', v_result ->> 'detail';
    insert into activity_log (category, severity, message)
    values ('system', 'green', 'Automatic operational alerts enabled: the generator runs every minute.');
  else
    raise warning 'ChopNow alerts: automatic generation is NOT enabled (%). The rest of this migration was applied. Schedule it by hand, see "IF SCHEDULING FAILED" at the bottom of this file.', v_result ->> 'detail';
    insert into activity_log (category, severity, message)
    values ('system', 'red', 'Automatic operational alerts are NOT running: could not schedule the generator (' || (v_result ->> 'detail') || '). Alerts will only appear when someone presses "Check now" until the job is scheduled.');
  end if;
end $$;

-- ============================================================================
-- IF SCHEDULING FAILED (or to re-schedule / verify at any time)
--
-- 1. Enable the extension: Supabase dashboard -> Database -> Extensions ->
--    pg_cron (or: create extension if not exists pg_cron;)
-- 2. Schedule the job (safe to repeat; replaces any existing job of this name):
--      select cron.unschedule('chopnow-generate-operational-alerts')
--        where exists (select 1 from cron.job where jobname = 'chopnow-generate-operational-alerts');
--      select cron.schedule('chopnow-generate-operational-alerts', '* * * * *',
--                           'select public.generate_operational_alerts()');
-- 3. Verify it exists and is running:
--      select jobid, jobname, schedule, active from cron.job
--       where jobname = 'chopnow-generate-operational-alerts';
--      select status, return_message, start_time from cron.job_run_details
--       where jobid = (select jobid from cron.job where jobname = 'chopnow-generate-operational-alerts')
--       order by start_time desc limit 5;       -- expect status = 'succeeded', about one row a minute
--      select public.operational_alerts_scheduler_status();   -- expect {"running": true, ...}
--      select public.generate_operational_alerts();           -- run once by hand, as admin
-- 4. To switch automatic alerts off again:
--      select cron.unschedule('chopnow-generate-operational-alerts');
-- 5. cron.job_run_details grows by about 1,440 rows a day; prune it now and then, e.g.
--      delete from cron.job_run_details where end_time < now() - interval '7 days';
-- ============================================================================

-- ============================================================================
-- IF THE REALTIME STEP FAILED (or to verify at any time)
--
-- Verify:
--   select * from pg_publication_tables
--    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'alerts';
--   -- one row = live updates are on; no rows = not on
-- Repair (either):
--   alter publication supabase_realtime add table public.alerts;
--   or Supabase dashboard -> Database -> Replication -> supabase_realtime -> toggle `alerts`.
-- If the publication itself is missing: create publication supabase_realtime;  then repeat.
-- Alerts are generated either way; only the live push to the page depends on this.
