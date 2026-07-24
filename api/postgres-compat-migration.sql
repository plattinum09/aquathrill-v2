-- PostgreSQL compatibility helpers for converted PHP files
-- Run once after/importing schema. Safe to re-run.

-- Required for availability upsert in availability.php
CREATE UNIQUE INDEX IF NOT EXISTS idx_boat_availability_unique
ON boat_availability (boat_type, slot_date, time_slot);

-- Optional: normalize common MySQL boolean-like columns to SMALLINT if imported differently.
-- ALTER TABLE boat_types ALTER COLUMN is_active TYPE SMALLINT USING CASE WHEN is_active THEN 1 ELSE 0 END;
-- ALTER TABLE manual_reviews ALTER COLUMN enabled TYPE SMALLINT USING CASE WHEN enabled THEN 1 ELSE 0 END;
