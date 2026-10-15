-- ============================================================================
-- 0013_automated_operational_alerts.sql
--
-- Server-side generation of operational alerts. Before this migration nothing
-- in the system ever inserted into `alerts` (no trigger, cron job or edge
-- function), so the Alerts page was always empty.
--
-- Run AFTER 0012_add_rider_delay_alert_type.sql (a separate transaction).
--
-- What this adds
--   1. Per-stage alert thresholds on stage_sla_config (admin-editable):
--        alert_after_seconds  NULL = no alert for this stage
--        alert_severity       red | amber | blue
--      The alert threshold is separate from, and never lower than, the
--      stage's SLA (sla_seconds). The SLA still drives the "Delayed" badge in
--      the pipeline; the alert threshold is when ops gets paged.
--   2. A platform_settings key `alert_undelivered_window_seconds`: how long
--      after payment an order may stay undelivered before it alerts.
--   3. alerts.incident_key + a unique index, so one incident = one alert.
--   4. public.overdue_order_incidents(now)  - the rules, as a query.
--      public.generate_operational_alerts() - creates / resolves / reopens.
--   5. alerts added to the supabase_realtime publication (idempotent).
--   6. A pg_cron job (every minute) that runs the generator, if pg_cron is
--      available on this database. See the notice raised at the end.
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
      add constraint stage_sla_alert_not_before_sla
        check (alert_after_seconds is null or alert_after_seconds >= sla_seconds);

    -- Defaults (assumptions, tune from the admin/SQL):
    --  new                       off   unpaid carts aren't an ops incident
    --  payment_confirmed         5m    paid but restaurant not notified
    --  restaurant_notified       5m    restaurant hasn't accepted
    --  restaurant_accepted       5m    accepted but kitchen hasn't started
    --  preparing                 30m   2x the 15m SLA: normal prep is not a delay
    --  ready_for_pickup          5m    waiting for a rider (red)
    --  rider_assigned            10m   rider hasn't set off
    --  rider_enroute_restaurant  15m
    --  picked_up                 5m    picked up but not heading out
    --  heading_to_customer       30m
    --  delivered                 off   terminal
    update stage_sla_config set alert_after_seconds = v.secs, alert_severity = v.sev
    from (values
      ('payment_confirmed',        300, 'amber'),
      ('restaurant_notified',      300, 'amber'),
      ('restaurant_accepted',      300, 'amber'),
      ('preparing',               1800, 'amber'),
      ('ready_for_pickup',         300, 'red'),
      ('rider_assigned',           600, 'amber'),
      ('rider_enroute_restaurant', 900, 'amber'),
      ('picked_up',                300, 'amber'),
      ('heading_to_customer',     1800, 'amber')
    ) as v(stage, secs, sev)
    where stage_sla_config.stage = v.stage::order_status;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2. Undelivered window (seconds after payment). 3600 = 60 minutes.
-- ----------------------------------------------------------------------------
insert into platform_settings (key, value)
values ('alert_undelivered_window_seconds', '3600')
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- 3. One incident = one alert
--    incident_key identifies a single occurrence of a condition, e.g.
--    'stage:preparing:1760400000' (the order entered `preparing` at that epoch)
--    or 'window:1760399000' (payment time). NULL for hand-made alerts, which
--    this machinery never touches.
-- ----------------------------------------------------------------------------
alter table alerts add column if not exists incident_key text;

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
-- 4a. The rules. Returns every incident that is active as of p_now.
--
-- Only orders still in flight are considered. completed / cancelled / refunded
-- / delivered never alert, and neither do unpaid `new` orders unless an admin
-- explicitly sets a threshold for `new`.
--
-- Stage entry time comes from the latest order_status_history row, and is only
-- trusted when that row's status matches orders.status. Orders without such a
-- row are skipped rather than guessed at.
--
--   stage incidents   time in current stage > stage_sla_config.alert_after_seconds
--       new..preparing                              -> restaurant_delay
--       ready_for_pickup (and no rider yet)         -> no_rider_accepted
--       rider_assigned..heading_to_customer         -> rider_delay
--   window incident   paid, undelivered, now - first payment_confirmed
--                     > alert_undelivered_window_seconds -> customer_wait_exceeded
-- ----------------------------------------------------------------------------
create or replace function public.overdue_order_incidents(p_now timestamptz default now())
returns table (
  order_id uuid,
  restaurant_id uuid,
  rider_id uuid,
  alert_type text,
  incident_key text,
  severity text,
  message text
)
language sql
stable
set search_path = public
as $$
  with live as (
    select o.id, o.order_number, o.status, o.restaurant_id, o.rider_id, r.name as restaurant_name
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
  paid as (
    select h.order_id, min(h.changed_at) as paid_at
    from order_status_history h
    where h.status = 'payment_confirmed' and h.order_id in (select id from live)
    group by h.order_id
  ),
  stage_incidents as (
    select
      l.id as order_id, l.restaurant_id, l.rider_id,
      case
        when l.status in ('new', 'payment_confirmed', 'restaurant_notified', 'restaurant_accepted', 'preparing')
          then 'restaurant_delay'
        when l.status = 'ready_for_pickup' then 'no_rider_accepted'
        else 'rider_delay'
      end as alert_type,
      'stage:' || l.status || ':' || floor(extract(epoch from c.changed_at))::bigint as incident_key,
      s.alert_severity as severity,
      l.order_number || ' (' || l.restaurant_name || ') has been in "'
        || initcap(replace(l.status::text, '_', ' ')) || '" for '
        || public.format_duration_short(extract(epoch from (p_now - c.changed_at)))
        || ' (alert threshold ' || public.format_duration_short(s.alert_after_seconds) || ')'
        || case when l.status = 'ready_for_pickup' then ' with no rider assigned' else '' end as message
    from live l
    join cur c on c.order_id = l.id and c.status = l.status
    join stage_sla_config s on s.stage = l.status
    where s.alert_after_seconds is not null
      and extract(epoch from (p_now - c.changed_at)) > s.alert_after_seconds
      and (l.status <> 'ready_for_pickup' or l.rider_id is null)
  ),
  window_incidents as (
    select
      l.id, l.restaurant_id, l.rider_id,
      'customer_wait_exceeded',
      'window:' || floor(extract(epoch from p.paid_at))::bigint,
      'red',
      l.order_number || ' (' || l.restaurant_name || ') is still undelivered '
        || public.format_duration_short(extract(epoch from (p_now - p.paid_at)))
        || ' after payment (limit ' || public.format_duration_short(w.secs) || ')'
    from live l
    join paid p on p.order_id = l.id
    cross join (
      select coalesce(
        (select (value #>> '{}')::numeric from platform_settings where key = 'alert_undelivered_window_seconds'),
        3600
      ) as secs
    ) w
    where l.status <> 'new'
      and extract(epoch from (p_now - p.paid_at)) > w.secs
  )
  select * from stage_incidents
  union all
  select * from window_incidents;
$$;

-- ----------------------------------------------------------------------------
-- 4b. The generator (core). Idempotent: safe to run as often as you like.
--
--   create  an alert for each active incident that has none
--   reopen  an alert that this system auto-resolved if its incident is active
--           again (an alert a human resolved, resolved_by is set, stays closed)
--   resolve alerts whose incident is no longer active (order advanced, was
--           cancelled/delivered, a rider got assigned...) - resolved_by stays
--           NULL, which is how "auto-resolved" is told apart from a human.
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
     set resolved_at = p_now
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
    insert into alerts (type, severity, message, order_id, restaurant_id, rider_id, incident_key, created_at)
    select i.alert_type::alert_type, i.severity, i.message, i.order_id, i.restaurant_id, i.rider_id, i.incident_key, p_now
    from _incidents i
    on conflict (order_id, type, incident_key) where incident_key is not null
    do update set resolved_at = null, message = excluded.message, severity = excluded.severity
      where alerts.resolved_at is not null and alerts.resolved_by is null
    returning (xmax = 0) as inserted
  )
  select count(*) filter (where inserted), count(*) filter (where not inserted)
    into v_created, v_reopened
    from upserted;

  drop table _incidents;

  return jsonb_build_object('created', v_created, 'reopened', v_reopened, 'resolved', v_resolved);
end;
$$;

-- ----------------------------------------------------------------------------
-- 4c. Public entry point: no arguments, always "now".
--     Called by pg_cron (no JWT) and, optionally, by the admin app's
--     "Check now" button (signed-in staff only).
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

revoke all on function public._generate_operational_alerts(timestamptz) from public, anon, authenticated;
revoke all on function public.generate_operational_alerts() from public, anon;
grant execute on function public.generate_operational_alerts() to authenticated, service_role;
revoke all on function public.overdue_order_incidents(timestamptz) from public, anon;
grant execute on function public.overdue_order_incidents(timestamptz) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. Realtime: make sure alerts is in the supabase_realtime publication so the
--    Alerts page's live subscription actually receives rows. No earlier
--    migration did this (it may have been switched on in the dashboard), so it
--    is guarded and does nothing when already present.
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'alerts'
     ) then
    alter publication supabase_realtime add table public.alerts;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 6. Schedule: every minute via pg_cron. Runs inside Postgres, so it fires
--    whether or not anyone has the dashboard open and needs no service-role key
--    anywhere outside the database. If pg_cron can't be enabled here the
--    migration still succeeds and tells you how to schedule it by hand.
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    if exists (select 1 from cron.job where jobname = 'chopnow-generate-operational-alerts') then
      perform cron.unschedule('chopnow-generate-operational-alerts');
    end if;
    perform cron.schedule(
      'chopnow-generate-operational-alerts',
      '* * * * *',
      'select public.generate_operational_alerts()'
    );
    raise notice 'pg_cron job chopnow-generate-operational-alerts scheduled (every minute).';
  else
    raise notice 'pg_cron is not available on this database. Enable it (Database > Extensions) and run: select cron.schedule(''chopnow-generate-operational-alerts'', ''* * * * *'', ''select public.generate_operational_alerts()'');';
  end if;
end $$;
