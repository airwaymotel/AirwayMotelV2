-- Reset all guest/stay data but keep users, permissions, and settings
-- Run this in Supabase SQL Editor

DELETE FROM operator_activity;
DELETE FROM signatures;
DELETE FROM payments;
DELETE FROM stays;
DELETE FROM guests;
DELETE FROM scan_sessions;

-- Reset room status back to available
UPDATE rooms SET status = 'available';

-- Reset auto-increment IDs (optional, keeps sequences clean)
-- Uncomment if needed:
-- ALTER SEQUENCE guests_id_seq RESTART WITH 1;
-- ALTER SEQUENCE stays_id_seq RESTART WITH 1;
-- ALTER SEQUENCE payments_id_seq RESTART WITH 1;
