-- ============================================================
-- Airway Motel — Role-Based Access Control
-- Run this ENTIRE script in the Supabase SQL Editor.
-- ============================================================

-- 1. USERS TABLE (replaces the old admin table)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'operator')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. OPERATOR PERMISSIONS TABLE
CREATE TABLE IF NOT EXISTS operator_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL CHECK (permission IN (
    'check_in',
    'view_dashboard',
    'view_rooms',
    'view_guests',
    'view_payments',
    'download_receipts',
    'download_forms'
  )),
  enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, permission)
);

-- 3. OPERATOR ACTIVITY TABLE
CREATE TABLE IF NOT EXISTS operator_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  stay_id UUID,
  guest_id UUID,
  room_id UUID,
  amount DECIMAL(10,2) DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. INDEXES
CREATE INDEX IF NOT EXISTS idx_operator_permissions_user_id ON operator_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_operator_activity_operator_id ON operator_activity(operator_id);
CREATE INDEX IF NOT EXISTS idx_operator_activity_created_at ON operator_activity(created_at DESC);

-- 5. SEED DEFAULT USERS
-- Super Admin: username=superadmin, password=1234
INSERT INTO users (username, password_hash, full_name, role, is_active)
VALUES ('superadmin', '1234', 'Super Admin', 'super_admin', true)
ON CONFLICT (username) DO NOTHING;

-- Operator: username=opone, password=op1234
INSERT INTO users (username, password_hash, full_name, role, is_active)
VALUES ('opone', 'op1234', 'Operator One', 'operator', true)
ON CONFLICT (username) DO NOTHING;

-- 6. SEED DEFAULT PERMISSIONS FOR opone (all enabled by default for demo)
INSERT INTO operator_permissions (user_id, permission, enabled)
SELECT u.id, p.permission, true
FROM users u
CROSS JOIN (VALUES
  ('check_in'),
  ('view_dashboard'),
  ('view_rooms'),
  ('view_guests'),
  ('view_payments'),
  ('download_receipts'),
  ('download_forms')
) AS p(permission)
WHERE u.username = 'opone'
ON CONFLICT (user_id, permission) DO NOTHING;

-- 7. ROW LEVEL SECURITY
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_activity ENABLE ROW LEVEL SECURITY;

-- Allow public read access for login
CREATE POLICY "Allow public read users" ON users FOR SELECT USING (true);
CREATE POLICY "Allow admin write users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public operator_permissions" ON operator_permissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public operator_activity" ON operator_activity FOR ALL USING (true) WITH CHECK (true);
