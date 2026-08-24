-- Reset all data but keep users, permissions, and settings
-- Run this in Supabase SQL Editor

DELETE FROM operator_activity;
DELETE FROM signatures;
DELETE FROM payments;
DELETE FROM stays;
DELETE FROM guests;
DELETE FROM scan_sessions;
DELETE FROM rooms;

-- Reset auto-increment IDs (optional, keeps sequences clean)
-- Uncomment if needed:
-- ALTER SEQUENCE guests_id_seq RESTART WITH 1;
-- ALTER SEQUENCE stays_id_seq RESTART WITH 1;
-- ALTER SEQUENCE payments_id_seq RESTART WITH 1;
