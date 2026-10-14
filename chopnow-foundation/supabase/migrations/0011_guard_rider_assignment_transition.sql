-- ============================================================================
-- 0011_guard_rider_assignment_transition.sql
--
-- Database-level backstop for the rider-assignment status bug found in
-- apps/admin/lib/actions/riders.ts::assignRiderToOrderAction: that
-- function previously assigned a rider to an order without checking the
-- order's current status, so it could silently push a cancelled,
-- delivered, completed, or refunded order back into "rider_assigned".
--
-- The application-level fix (RIDER_ASSIGNABLE_STATUSES check in
-- riders.ts) now rejects this before the write. This trigger is a
-- defense-in-depth backstop at the database layer, so the same mistake
-- in a future code path (another admin tool, a script, a bug) can't
-- bypass the application check and corrupt order state directly.
--
-- Scoped narrowly to only the rider-assignment transition itself (new
-- status = 'rider_assigned' with a rider_id change) — it does NOT touch
-- orders_update_admin's broader UPDATE permissions, so
-- advanceOrderStatusAction and cancelOrderAction (which both set
-- different statuses, from any current status, by design) are
-- unaffected. This keeps the change minimal rather than reworking the
-- shared admin UPDATE policy to understand every action's own rules.
-- ============================================================================

create or replace function public.guard_rider_assignment_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'rider_assigned'
     and (old.rider_id is distinct from new.rider_id)
     and old.status not in ('ready_for_pickup', 'rider_assigned') then
    raise exception
      'Cannot assign a rider to order %: current status "%" is not eligible for rider assignment (must be ready_for_pickup or already rider_assigned).',
      old.id, old.status
      using errcode = '23514'; -- check_violation
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_rider_assignment_transition on orders;
create trigger trg_guard_rider_assignment_transition
  before update of status, rider_id on orders
  for each row execute procedure public.guard_rider_assignment_transition();
