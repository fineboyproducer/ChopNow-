-- ============================================================================
-- 0009_rider_earnings.sql
--
-- Adds rider earnings tracking. No rider_earnings table existed before
-- this migration — Sprint 6 (Rider App) needs a real, non-fabricated
-- number to show on the Earnings screen, so this defines exactly how a
-- delivery's payout is computed and where it's recorded, rather than
-- having the UI invent a number client-side.
--
-- Payout model (kept simple and transparent for MVP): a flat base fee
-- plus a per-kilometer component, computed once at delivery time from
-- the order's delivery distance. This mirrors how most last-mile
-- delivery platforms structure rider pay and is easy to explain to a
-- rider looking at their earnings screen. Revisit alongside the PRD's
-- future Wallet feature (Section 13) if a more sophisticated payout
-- model (surge pricing, tips, etc.) is needed later.
-- ============================================================================

alter table orders add column if not exists rider_earnings integer;

create table if not exists rider_payout_config (
  key text primary key,
  value numeric not null
);

insert into rider_payout_config (key, value) values
  ('base_fee_naira', 300),
  ('per_km_naira', 60)
on conflict (key) do nothing;

alter table rider_payout_config enable row level security;

create policy "rider_payout_config_select_all" on rider_payout_config
  for select using (true);

create policy "rider_payout_config_write_admin" on rider_payout_config
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ----------------------------------------------------------------------------
-- Compute and record rider_earnings the moment an order is delivered,
-- using the restaurant-to-delivery-address distance and the payout
-- config above. Implemented as a trigger (same pattern as
-- set_delivered_at in 0008) so it can never be skipped regardless of
-- which app performs the transition.
-- ----------------------------------------------------------------------------
create or replace function public.set_rider_earnings()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_fee numeric;
  per_km numeric;
  restaurant_lat numeric;
  restaurant_lng numeric;
  distance_km numeric;
  d_lat double precision;
  d_lng double precision;
  lat1 double precision;
  lat2 double precision;
  h double precision;
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered' and new.rider_id is not null then
    select value into base_fee from rider_payout_config where key = 'base_fee_naira';
    select value into per_km from rider_payout_config where key = 'per_km_naira';

    select lat, lng into restaurant_lat, restaurant_lng from restaurants where id = new.restaurant_id;

    if restaurant_lat is not null and new.delivery_lat is not null then
      -- Haversine formula, matching packages/lib/utils/distance.ts's
      -- haversineDistanceKm exactly (same sin^2 form, not the spherical
      -- law-of-cosines variant, which loses precision at short distances
      -- via floating-point cancellation inside acos() near 1 — a real
      -- concern here since most ChopNow deliveries are just a few km).
      d_lat := radians(new.delivery_lat - restaurant_lat);
      d_lng := radians(new.delivery_lng - restaurant_lng);
      lat1 := radians(restaurant_lat);
      lat2 := radians(new.delivery_lat);
      h := sin(d_lat / 2) ^ 2 + cos(lat1) * cos(lat2) * sin(d_lng / 2) ^ 2;
      distance_km := 6371 * 2 * atan2(sqrt(h), sqrt(1 - h));
    else
      distance_km := 0;
    end if;

    new.rider_earnings := round(coalesce(base_fee, 300) + coalesce(per_km, 60) * distance_km);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_rider_earnings on orders;
create trigger trg_set_rider_earnings
  before update of status on orders
  for each row execute procedure public.set_rider_earnings();
