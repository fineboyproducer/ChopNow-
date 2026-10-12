-- ============================================================================
-- 0005_fix_order_items_menu_item_fk.sql
--
-- Fixes a bug from 0004_orders.sql: order_items.menu_item_id referenced
-- menu_items(id) with no ON DELETE clause, which defaults to Postgres's
-- NO ACTION/RESTRICT behavior. In practice this meant deleting a menu
-- item that had ever been ordered would fail with a raw foreign key
-- violation instead of succeeding cleanly — order_items already
-- snapshots name/price/quantity independent of the live menu_items row
-- (PRD Section 7.1), so there's no reason a menu item's lifecycle should
-- be blocked by its own order history. This migration changes the FK to
-- ON DELETE SET NULL, matching the documented intent in
-- apps/admin/lib/actions/menus.ts's deleteMenuItemAction.
-- ============================================================================

alter table order_items drop constraint if exists order_items_menu_item_id_fkey;

alter table order_items
  add constraint order_items_menu_item_id_fkey
  foreign key (menu_item_id) references menu_items(id) on delete set null;
