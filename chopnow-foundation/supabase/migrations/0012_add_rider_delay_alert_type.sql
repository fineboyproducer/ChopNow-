-- ============================================================================
-- 0012_add_rider_delay_alert_type.sql
--
-- Adds a `rider_delay` value to the alert_type enum, for orders that are
-- stuck in a rider-side stage (rider assigned, en route to the restaurant,
-- picked up, heading to the customer). The existing values only cover the
-- kitchen side (restaurant_delay) and "no rider yet" (no_rider_accepted).
--
-- Kept in its own migration on purpose: a newly added enum value can't be
-- used in the same transaction that adds it, so run this file on its own
-- BEFORE 0013_automated_operational_alerts.sql. Additive and idempotent.
-- ============================================================================

alter type alert_type add value if not exists 'rider_delay';
