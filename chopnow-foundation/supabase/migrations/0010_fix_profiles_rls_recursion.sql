-- ============================================================================
-- 0010_fix_profiles_rls_recursion.sql
-- Fixes "infinite recursion detected in policy for relation profiles"
-- (Postgres error 42P17), which breaks every authenticated request —
-- including requests to tables other than `profiles` — because Postgres
-- evaluates ALL of a table's RLS policies together whenever that table is
-- touched, even from inside another table's policy subquery.
--
-- Root cause: 0001_extensions_and_profiles.sql's `profiles_select_admin`
-- policy queries `profiles` from within a policy ON `profiles`:
--
--   create policy "profiles_select_admin" on profiles
--     for select using (
--       exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
--     );
--
-- Evaluating that subquery requires re-applying every select policy on
-- `profiles` — including this one — forever. Any other policy elsewhere
-- that also does `exists (select 1 from profiles where ...)` (restaurants,
-- orders, riders, alerts, etc. — see migrations 0003/0004/0006/0007/0009)
-- triggers the same recursion the moment it touches `profiles`, even
-- though those policies aren't self-referencing on their own table.
--
-- Fix: a SECURITY DEFINER function bypasses RLS for its own internal
-- query (it runs as the function owner, not the calling user), so it can
-- check a role in `profiles` without re-triggering `profiles`' own
-- policies. Every policy that was doing this check inline now calls the
-- function instead — same behavior, no recursion, and Postgres can plan
-- it once instead of re-evaluating a subquery per row.
-- ============================================================================

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role in ('admin', 'dispatcher')
  );
$$;

-- profiles --------------------------------------------------------------
drop policy if exists "profiles_select_admin" on profiles;
create policy "profiles_select_admin" on profiles
  for select using (public.is_admin());

-- restaurants -------------------------------------------------------------
drop policy if exists "restaurants_write_admin" on restaurants;
create policy "restaurants_write_admin" on restaurants
  for insert with check (public.is_staff());

drop policy if exists "restaurants_update_admin" on restaurants;
create policy "restaurants_update_admin" on restaurants
  for update using (public.is_staff());

drop policy if exists "restaurants_delete_admin" on restaurants;
create policy "restaurants_delete_admin" on restaurants
  for delete using (public.is_admin());

-- menu_categories / menu_items --------------------------------------------
drop policy if exists "menu_categories_write_admin" on menu_categories;
create policy "menu_categories_write_admin" on menu_categories
  for all using (public.is_staff());

drop policy if exists "menu_items_write_admin" on menu_items;
create policy "menu_items_write_admin" on menu_items
  for all using (public.is_staff());

-- orders / order_items / order_status_history ------------------------------
drop policy if exists "orders_select_admin" on orders;
create policy "orders_select_admin" on orders
  for select using (public.is_staff());

drop policy if exists "orders_update_admin" on orders;
create policy "orders_update_admin" on orders
  for update using (public.is_staff());

drop policy if exists "order_items_select_admin" on order_items;
create policy "order_items_select_admin" on order_items
  for select using (public.is_staff());

drop policy if exists "order_status_history_select_admin" on order_status_history;
create policy "order_status_history_select_admin" on order_status_history
  for select using (public.is_staff());

-- platform_settings ---------------------------------------------------------
drop policy if exists "platform_settings_write_admin" on platform_settings;
create policy "platform_settings_write_admin" on platform_settings
  for update using (public.is_admin());

drop policy if exists "platform_settings_insert_admin" on platform_settings;
create policy "platform_settings_insert_admin" on platform_settings
  for insert with check (public.is_admin());

-- riders / stage_sla_config / dispatch_attempts / rider_locations /
-- alerts / activity_log (ops center) ----------------------------------------
drop policy if exists "riders_select_staff" on riders;
create policy "riders_select_staff" on riders
  for select using (public.is_staff());

drop policy if exists "riders_update_staff" on riders;
create policy "riders_update_staff" on riders
  for update using (public.is_staff());

drop policy if exists "riders_insert_staff" on riders;
create policy "riders_insert_staff" on riders
  for insert with check (public.is_staff());

drop policy if exists "stage_sla_config_select_staff" on stage_sla_config;
create policy "stage_sla_config_select_staff" on stage_sla_config
  for select using (public.is_staff());

drop policy if exists "stage_sla_config_write_admin" on stage_sla_config;
create policy "stage_sla_config_write_admin" on stage_sla_config
  for update using (public.is_admin());

drop policy if exists "dispatch_attempts_select_staff" on dispatch_attempts;
create policy "dispatch_attempts_select_staff" on dispatch_attempts
  for select using (public.is_staff());

drop policy if exists "dispatch_attempts_write_staff" on dispatch_attempts;
create policy "dispatch_attempts_write_staff" on dispatch_attempts
  for insert with check (public.is_staff());

drop policy if exists "rider_locations_select_staff" on rider_locations;
create policy "rider_locations_select_staff" on rider_locations
  for select using (public.is_staff());

drop policy if exists "alerts_select_staff" on alerts;
create policy "alerts_select_staff" on alerts
  for select using (public.is_staff());

drop policy if exists "alerts_write_system_staff" on alerts;
create policy "alerts_write_system_staff" on alerts
  for insert with check (public.is_staff());

drop policy if exists "alerts_resolve_staff" on alerts;
create policy "alerts_resolve_staff" on alerts
  for update using (public.is_staff());

drop policy if exists "activity_log_select_staff" on activity_log;
create policy "activity_log_select_staff" on activity_log
  for select using (public.is_staff());

drop policy if exists "activity_log_write_staff" on activity_log;
create policy "activity_log_write_staff" on activity_log
  for insert with check (public.is_staff());

-- rider_payout_config ---------------------------------------------------
drop policy if exists "rider_payout_config_write_admin" on rider_payout_config;
create policy "rider_payout_config_write_admin" on rider_payout_config
  for update using (public.is_admin());
