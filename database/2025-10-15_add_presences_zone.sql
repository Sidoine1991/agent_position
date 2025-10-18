-- Migration: add zone/geofencing fields to presences
-- Safe to run multiple times (IF NOT EXISTS guards)

ALTER TABLE IF EXISTS presences
  ADD COLUMN IF NOT EXISTS zone_id INTEGER NULL,
  ADD COLUMN IF NOT EXISTS within_tolerance BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS distance_from_reference_m INTEGER NULL,
  ADD COLUMN IF NOT EXISTS tolerance_meters INTEGER NULL;

-- Optional helpful indexes
CREATE INDEX IF NOT EXISTS idx_presences_zone_id ON presences(zone_id);
CREATE INDEX IF NOT EXISTS idx_presences_within_tolerance ON presences(within_tolerance);

