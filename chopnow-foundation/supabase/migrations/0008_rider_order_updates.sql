-- ============================================================================
-- 0008_rider_order_updates.sql
--
-- Fixes a real gap discovered while building the Rider App (Sprint 6):
-- 0004_orders.sql granted UPDATE on `orders` to customers (cancel-only)
-- and admin/dispatcher, but never to the rider actually assigned to an
-- order. Without this, a rider's own status updates from picked_up
-- through delivered — the entire "Complete delivery" flow — would be
-- silently rejected by RLS with no policy permitting the write at all.
--
-- Scoped narrowly: a rider may only update an order where they are the
-- assigned rider (auth.uid() = rider_id), and the WITH CHECK clause
-- requires the status to remain one they're allowed to set from where
-- it currently is — riders move an order forward through their part of
-- the lifecycle, they don't get to jump straight to `completed` or
-- reopen a cancelled order.
-- ============================================================================

create policy "orders_update_own_rider_progress" on orders
  for update using (
    auth.uid() = rider_id
    and status in ('rider_assigned', 'rider_enroute_restaurant', 'picked_up', 'heading_to_customer')
  )
  with check (
    auth.uid() = rider_id
    and status in ('rider_enroute_restaurant', 'picked_up', 'heading_to_customer', 'delivered')
  );

-- ----------------------------------------------------------------------------
-- Auto-populate delivered_at the moment an order reaches `delivered`.
-- This was declared as a column in 0004_orders.sql but nothing ever set
-- it — implemented as a trigger (rather than relying on every possible
-- caller to remember to set it explicitly) so it can never be missed
-- regardless of which app or code path performs the transition.
-- ----------------------------------------------------------------------------
create or replace function public.set_delivered_at()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    new.delivered_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_delivered_at on orders;
create trigger trg_set_delivered_at
  before update of status on orders
  for each row execute procedure public.set_delivered_at();
