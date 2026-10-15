-- ============================================================================
-- 0012_add_alert_types_for_automated_alerts.sql
--
-- Adds two values to the alert_type enum used by the automated alerts in 0013:
--   rider_delay       an order is stuck in a rider-side stage (rider assigned,
--                     en route to the restaurant, picked up, heading to the
--                     customer)
--   paid_order_stuck  a customer has paid but the order never left `new`
--
-- Kept in its own migration on purpose: a newly added enum value can't be used
-- in the same transaction that adds it, so run this file on its own BEFORE
-- 0013_automated_operational_alerts.sql. (If 0013 is applied first it still
-- installs, but the generator then fails at runtime with "invalid input value
-- for enum alert_type" the first time one of these incidents occurs.)
-- Additive and idempotent.
-- ============================================================================

alter type alert_type add value if not exists 'rider_delay';
alter type alert_type add value if not exists 'paid_order_stuck';
