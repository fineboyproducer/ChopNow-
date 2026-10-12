-- ============================================================================
-- 0004_orders.sql
-- Platform settings (global markup), orders, and order_items.
-- Status enum matches PRD Section 8 (14 lifecycle statuses).
-- ============================================================================

create table if not exists platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into platform_settings (key, value)
values ('global_markup_percent', '8')
on conflict (key) do nothing;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type order_status as enum (
      'new',
      'payment_confirmed',
      'restaurant_notified',
      'restaurant_accepted',
      'preparing',
      'ready_for_pickup',
      'rider_assigned',
      'rider_enroute_restaurant',
      'picked_up',
      'heading_to_customer',
      'delivered',
      'completed',
      'cancelled',
      'refunded'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type payment_method as enum ('paystack', 'flutterwave', 'cash');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type payment_status as enum ('pending', 'paid', 'failed', 'refunded');
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Human-readable order numbers (e.g. "CN-4821"), generated server-side by
-- a sequence so they're guaranteed unique and monotonically increasing
-- without a round trip to check for collisions.
-- ----------------------------------------------------------------------------
create sequence if not exists order_number_seq start 1000;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('CN-' || nextval('order_number_seq')::text),
  customer_id uuid not null references profiles(id),
  restaurant_id uuid not null references restaurants(id),
  rider_id uuid references profiles(id),
  status order_status not null default 'new',
  delivery_address_id uuid references addresses(id),
  delivery_lat numeric(9, 6),
  delivery_lng numeric(9, 6),
  delivery_full_address text not null,
  delivery_phone text not null,
  subtotal integer not null check (subtotal >= 0),
  delivery_fee integer not null check (delivery_fee >= 0),
  service_fee integer not null check (service_fee >= 0),
  total integer not null check (total >= 0),
  payment_method payment_method not null,
  payment_reference text,
  payment_status payment_status not null default 'pending',
  estimated_delivery_minutes integer,
  placed_at timestamptz not null default now(),
  delivered_at timestamptz,
  cancelled_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_customer on orders(customer_id, created_at desc);
create index if not exists idx_orders_restaurant on orders(restaurant_id, created_at desc);
create index if not exists idx_orders_status on orders(status) where status not in ('completed', 'cancelled', 'refunded');
create index if not exists idx_orders_payment_reference on orders(payment_reference) where payment_reference is not null;

alter table orders enable row level security;

-- Customers see only their own orders.
create policy "orders_select_own" on orders
  for select using (auth.uid() = customer_id);

-- Orders are created exclusively through the createOrder server action
-- using the service-role client (see lib/actions/orders.ts) so that
-- price validation happens server-side and can never be bypassed by a
-- direct client insert. No customer-facing insert policy is granted here
-- deliberately — this is the enforcement point for FR-CHECK-02 (checkout
-- must reflect true, server-computed pricing).
create policy "orders_select_admin" on orders
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'dispatcher'))
  );

create policy "orders_select_rider" on orders
  for select using (auth.uid() = rider_id);

-- Customers may only update their own order, and only to cancel it while
-- it's still in a customer-cancellable stage (PRD Section 7.4). Broader
-- status transitions (restaurant/rider/admin driven) go through the
-- service-role client from trusted server code, not this policy.
create policy "orders_update_own_cancel" on orders
  for update using (
    auth.uid() = customer_id
    and status in ('new', 'payment_confirmed', 'restaurant_notified', 'restaurant_accepted')
  )
  with check (
    auth.uid() = customer_id
    and status = 'cancelled'
  );

create policy "orders_update_admin" on orders
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'dispatcher'))
  );

-- ----------------------------------------------------------------------------
-- ORDER ITEMS
-- Snapshotted at purchase time (name, base price, markup, final price) so
-- a later menu change never retroactively changes a past order's price,
-- per PRD Section 7.1.
-- ----------------------------------------------------------------------------
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id),
  name_at_purchase text not null,
  base_price_at_purchase integer not null check (base_price_at_purchase >= 0),
  markup_applied integer not null default 0 check (markup_applied >= 0),
  price_at_purchase integer not null check (price_at_purchase >= 0),
  quantity integer not null check (quantity > 0),
  special_instructions text
);

create index if not exists idx_order_items_order on order_items(order_id);

alter table order_items enable row level security;

create policy "order_items_select_own" on order_items
  for select using (
    exists (select 1 from orders o where o.id = order_items.order_id and o.customer_id = auth.uid())
  );

create policy "order_items_select_admin" on order_items
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'dispatcher'))
  );

-- ----------------------------------------------------------------------------
-- STAGE HISTORY — one row per status transition, per PRD Section 8 / FR-ORD-02
-- ----------------------------------------------------------------------------
create table if not exists order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references orders(id) on delete cascade,
  status order_status not null,
  changed_by uuid references profiles(id),
  changed_at timestamptz not null default now()
);

create index if not exists idx_order_status_history_order on order_status_history(order_id, changed_at);

alter table order_status_history enable row level security;

create policy "order_status_history_select_own" on order_status_history
  for select using (
    exists (select 1 from orders o where o.id = order_status_history.order_id and o.customer_id = auth.uid())
  );

create policy "order_status_history_select_admin" on order_status_history
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'dispatcher'))
  );

-- Record every status change automatically, so callers never have to
-- remember to insert into order_status_history manually. Two triggers
-- call this: one AFTER INSERT (old is null, so the IS DISTINCT FROM
-- comparison is true and the initial status is recorded), and one AFTER
-- UPDATE OF status (which only fires when status genuinely changes,
-- since Postgres only fires "UPDATE OF <column>" triggers when that
-- column's value is part of the UPDATE statement's SET list).
create or replace function public.record_order_status_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into order_status_history (order_id, status, changed_by)
    values (new.id, new.status, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_record_order_status_insert on orders;
create trigger trg_record_order_status_insert
  after insert on orders
  for each row execute procedure public.record_order_status_change();

drop trigger if exists trg_record_order_status_update on orders;
create trigger trg_record_order_status_update
  after update of status on orders
  for each row execute procedure public.record_order_status_change();
