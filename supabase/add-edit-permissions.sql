-- ============================================================
-- Migration: Add edit_guests, edit_rooms, manage_discounts permissions
-- Run this in Supabase SQL Editor if you already ran rbac.sql
-- ============================================================

-- 1. Drop the old CHECK constraint on permission column
ALTER TABLE operator_permissions DROP CONSTRAINT IF EXISTS operator_permissions_permission_check;

-- 2. Add new CHECK constraint with all permissions
ALTER TABLE operator_permissions ADD CONSTRAINT operator_permissions_permission_check
  CHECK (permission IN (
    'check_in',
    'view_dashboard',
    'view_rooms',
    'view_guests',
    'view_payments',
    'download_receipts',
    'download_forms',
    'edit_guests',
    'edit_rooms',
    'manage_discounts'
  ));

-- 3. Insert new permissions for all existing operators (enabled by default)
INSERT INTO operator_permissions (user_id, permission, enabled)
SELECT u.id, p.permission, true
FROM users u
CROSS JOIN (VALUES
  ('edit_guests'),
  ('edit_rooms'),
  ('manage_discounts')
) AS p(permission)
WHERE u.role = 'operator'
ON CONFLICT (user_id, permission) DO NOTHING;
