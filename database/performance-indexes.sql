-- AQUATHRILL production performance indexes
-- Safe to run multiple times on PostgreSQL.
-- These indexes match the public booking calendar, Omise sync, and admin filters.

CREATE INDEX IF NOT EXISTS idx_bookings_boat_date_slot_status
  ON bookings (boat_type, booking_date, time_slot, status);

CREATE INDEX IF NOT EXISTS idx_bookings_date_status
  ON bookings (booking_date, status);

CREATE INDEX IF NOT EXISTS idx_boat_availability_slot_date
  ON boat_availability (slot_date);

CREATE INDEX IF NOT EXISTS idx_boat_availability_date_boat_slot
  ON boat_availability (slot_date, boat_type, time_slot);

CREATE INDEX IF NOT EXISTS idx_payment_logs_booking_method_status_id
  ON payment_logs (booking_id, payment_method, status, id DESC);

CREATE INDEX IF NOT EXISTS idx_payment_logs_booking_id_id
  ON payment_logs (booking_id, id DESC);
