-- ============================================================================
-- 0006_platform_settings_rls.sql
--
-- Fixes a gap from 0004_orders.sql: platform_settings was created
-- without enabling Row Level Security at all. Since this table holds
-- business-critical configuration (currently the global markup
-- percentage — PRD Section 7.1), leaving RLS disabled means Postgres
-- falls back to default grants rather than the explicit, intentional
-- policies used everywhere else in this schema — the exact gap RLS
-- exists to close. This migration enables RLS and adds policies
-- matching the same admin-only write / public-read pattern used for
-- restaurants and menu_items. Public read access is required because
-- the customer-facing markup calculation (packages/lib/utils/currency.ts,
-- applyMarkup) reads this value from unauthenticated/customer contexts
-- when computing display prices.
-- ============================================================================

alter table platform_settings enable row level security;

create policy "platform_settings_select_public" on platform_settings
  for select using (true);

create policy "platform_settings_write_admin" on platform_settings
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "platform_settings_insert_admin" on platform_settings
  for insert with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );
