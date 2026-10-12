-- ============================================================================
-- 0007_ops_center.sql
--
-- Adds the tables the Ops & Dispatch Center needs, per
-- "ChopNow — Operations & Dispatch Architecture," Section 3 (Database
-- Additions). Reconciled against what Sprint 3 already built:
--   - order_status already has the full 14-value lifecycle (0004_orders.sql)
--     — the architecture doc's enum-recreation dance is not re-run here.
--   - order_status_history already exists (0004_orders.sql) and plays the
--     same role as the doc's "order_stage_history" — extended in place
--     with exited_at/handler_type/handler_id rather than creating a
--     second, competing history table.
--   - riders did not exist as a real table yet (only profiles.role =
--     'rider') — created here as a 1:1 extension of profiles, matching
--     packages/types/src/rider.ts's Rider interface.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- RIDERS — one row per profile with role = 'rider'
-- ----------------------------------------------------------------------------
create table if not exists riders (
  id uuid primary key references profiles(id) on delete cascade,
  vehicle_type text not null default 'motorbike',
  is_online boolean not null default false,
  status text not null default 'idle' check (status in ('idle', 'assigned', 'enroute_restaurant', 'picked_up', 'delivering')),
  current_lat numeric(9, 6),
  current_lng numeric(9, 6),
  rating numeric(2, 1) not null default 5.0,
  acceptance_rate numeric(5, 2) not null default 100,
  avg_delivery_minutes numeric(6, 2) not null default 25,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_riders_online on riders(is_online, status) where is_active = true;

alter table riders enable row level security;

create policy "riders_select_own" on riders
  for select using (auth.uid() = id);

create policy "riders_select_staff" on riders
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'dispatcher'))
  );

create policy "riders_update_own" on riders
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "riders_update_staff" on riders
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'dispatcher'))
  );

create policy "riders_insert_staff" on riders
  for insert with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'dispatcher'))
  );

-- ----------------------------------------------------------------------------
-- ORDER STATUS HISTORY — extend the existing table (see header note)
-- rather than creating a second one.
-- ----------------------------------------------------------------------------
alter table order_status_history add column if not exists exited_at timestamptz;
alter table order_status_history add column if not exists handler_type text check (handler_type in ('restaurant', 'rider', 'system', 'admin'));
alter table order_status_history add column if not exists handler_id uuid;

-- Backfill exited_at for existing rows: each row's exit time is the next
-- row's entry time, for the same order, ordered by changed_at. The most
-- recent row per order has no exited_at (still in that stage).
update order_status_history h
set exited_at = nxt.changed_at
from (
  select id, order_id, changed_at,
         lead(changed_at) over (partition by order_id order by changed_at) as next_changed_at
  from order_status_history
) nxt
where h.id = nxt.id and h.exited_at is null and nxt.next_changed_at is not null;

-- ----------------------------------------------------------------------------
-- SLA CONFIG — per-stage delay thresholds, editable by admin
-- ----------------------------------------------------------------------------
create table if not exists stage_sla_config (
  stage order_status primary key,
  sla_seconds integer not null check (sla_seconds >= 0)
);

insert into stage_sla_config (stage, sla_seconds) values
  ('new', 30),
  ('payment_confirmed', 20),
  ('restaurant_notified', 60),
  ('restaurant_accepted', 120),
  ('preparing', 900),
  ('ready_for_pickup', 180),
  ('rider_assigned', 90),
  ('rider_enroute_restaurant', 300),
  ('picked_up', 60),
  ('heading_to_customer', 600),
  ('delivered', 60)
on conflict (stage) do nothing;

alter table stage_sla_config enable row level security;

create policy "stage_sla_config_select_staff" on stage_sla_config
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'dispatcher'))
  );

create policy "stage_sla_config_write_admin" on stage_sla_config
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ----------------------------------------------------------------------------
-- DISPATCH ATTEMPTS — full scoring breakdown per rider offer, per order
-- ----------------------------------------------------------------------------
create table if not exists dispatch_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  rider_id uuid references riders(id),
  score numeric,
  score_breakdown jsonb,
  offered_at timestamptz not null default now(),
  responded_at timestamptz,
  outcome text check (outcome in ('accepted', 'rejected', 'timed_out', 'cancelled'))
);

create index if not exists idx_dispatch_attempts_order on dispatch_attempts(order_id, offered_at desc);
create index if not exists idx_dispatch_attempts_rider on dispatch_attempts(rider_id, offered_at desc);

alter table dispatch_attempts enable row level security;

create policy "dispatch_attempts_select_staff" on dispatch_attempts
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'dispatcher'))
  );

create policy "dispatch_attempts_select_own_rider" on dispatch_attempts
  for select using (auth.uid() = rider_id);

create policy "dispatch_attempts_write_staff" on dispatch_attempts
  for insert with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'dispatcher'))
  );

-- Riders can respond to their own offered dispatch attempts (accept/reject),
-- but only update the outcome/responded_at on rows already addressed to them.
create policy "dispatch_attempts_respond_own_rider" on dispatch_attempts
  for update using (auth.uid() = rider_id)
  with check (auth.uid() = rider_id);

-- ----------------------------------------------------------------------------
-- RIDER LOCATIONS — time-series GPS pings while on an active delivery
-- ----------------------------------------------------------------------------
create table if not exists rider_locations (
  id bigint generated always as identity primary key,
  rider_id uuid not null references riders(id) on delete cascade,
  lat numeric(9, 6) not null,
  lng numeric(9, 6) not null,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_rider_locations_recent on rider_locations(rider_id, recorded_at desc);

alter table rider_locations enable row level security;

create policy "rider_locations_insert_own" on rider_locations
  for insert with check (auth.uid() = rider_id);

create policy "rider_locations_select_staff" on rider_locations
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'dispatcher'))
  );

-- A customer may see location pings only for the rider currently
-- assigned to one of their own active orders — not any rider's location
-- generally.
create policy "rider_locations_select_customer_active_order" on rider_locations
  for select using (
    exists (
      select 1 from orders o
      where o.rider_id = rider_locations.rider_id
        and o.customer_id = auth.uid()
        and o.status not in ('completed', 'cancelled', 'refunded', 'delivered')
    )
  );

-- ----------------------------------------------------------------------------
-- ALERTS — color-coded operational alerts (PRD Section 11.4)
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'alert_type') then
    create type alert_type as enum (
      'restaurant_delay',
      'no_rider_accepted',
      'customer_wait_exceeded',
      'restaurant_offline',
      'rider_offline_midway',
      'payment_failed',
      'order_cancelled',
      'high_demand'
    );
  end if;
end $$;

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  type alert_type not null,
  severity text not null check (severity in ('red', 'amber', 'blue')),
  message text not null,
  order_id uuid references orders(id),
  restaurant_id uuid references restaurants(id),
  rider_id uuid references riders(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles(id)
);

create index if not exists idx_alerts_active on alerts(created_at desc) where resolved_at is null;

alter table alerts enable row level security;

create policy "alerts_select_staff" on alerts
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'dispatcher'))
  );

create policy "alerts_write_system_staff" on alerts
  for insert with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'dispatcher'))
  );

create policy "alerts_resolve_staff" on alerts
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'dispatcher'))
  );

-- ----------------------------------------------------------------------------
-- ACTIVITY LOG — single source of truth for the live activity feed
-- ----------------------------------------------------------------------------
create table if not exists activity_log (
  id bigint generated always as identity primary key,
  category text not null check (category in ('order', 'rider', 'restaurant', 'payment', 'system')),
  severity text not null default 'blue' check (severity in ('green', 'blue', 'amber', 'red')),
  message text not null,
  order_id uuid references orders(id),
  rider_id uuid references riders(id),
  restaurant_id uuid references restaurants(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_log_recent on activity_log(created_at desc);

alter table activity_log enable row level security;

create policy "activity_log_select_staff" on activity_log
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'dispatcher'))
  );

create policy "activity_log_write_staff" on activity_log
  for insert with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'dispatcher'))
  );

-- ----------------------------------------------------------------------------
-- TRIGGERS — write to activity_log automatically on meaningful state
-- changes, so the feed can never drift from what actually happened (per
-- the architecture doc's design intent — "the frontend just subscribes
-- to INSERT on that one table rather than deriving feed entries
-- client-side from multiple tables").
-- ----------------------------------------------------------------------------
create or replace function public.log_order_status_activity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  severity_value text;
begin
  severity_value := case
    when new.status in ('completed', 'delivered') then 'green'
    when new.status in ('cancelled', 'refunded') then 'red'
    else 'blue'
  end;

  insert into activity_log (category, severity, message, order_id, restaurant_id)
  values (
    'order',
    severity_value,
    'Order ' || new.order_number || ' -> ' || new.status,
    new.id,
    new.restaurant_id
  );
  return new;
end;
$$;

drop trigger if exists trg_log_order_status_activity on orders;
create trigger trg_log_order_status_activity
  after insert or update of status on orders
  for each row execute procedure public.log_order_status_activity();

create or replace function public.log_rider_online_activity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (tg_op = 'UPDATE') and (new.is_online is distinct from old.is_online) then
    insert into activity_log (category, severity, message, rider_id)
    values ('rider', 'blue', 'Rider ' || new.id || ' went ' || (case when new.is_online then 'online' else 'offline' end), new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_rider_online_activity on riders;
create trigger trg_log_rider_online_activity
  after update of is_online on riders
  for each row execute procedure public.log_rider_online_activity();

create or replace function public.log_restaurant_status_activity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (tg_op = 'UPDATE') and (new.status is distinct from old.status) then
    insert into activity_log (category, severity, message, restaurant_id)
    values (
      'restaurant',
      case when new.status = 'offline' then 'amber' else 'blue' end,
      new.name || ' is now ' || new.status,
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_restaurant_status_activity on restaurants;
create trigger trg_log_restaurant_status_activity
  after update of status on restaurants
  for each row execute procedure public.log_restaurant_status_activity();
