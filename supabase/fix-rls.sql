-- ============================================================
-- Fix RLS policies for auth tables
-- Run this in Supabase SQL Editor if login returns "Invalid username or password"
-- ============================================================

-- Enable RLS (Supabase may have enabled it by default)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_activity ENABLE ROW LEVEL SECURITY;

-- Allow anon (public) key to read users for login
DROP POLICY IF EXISTS "Allow public read users" ON users;
CREATE POLICY "Allow public read users" ON users
  FOR SELECT
  USING (true);

-- Allow anon to insert/update/delete users (super admin operations)
DROP POLICY IF EXISTS "Allow admin write users" ON users;
CREATE POLICY "Allow admin write users" ON users
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Allow anon full access to operator_permissions
DROP POLICY IF EXISTS "Allow public operator_permissions" ON operator_permissions;
CREATE POLICY "Allow public operator_permissions" ON operator_permissions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Allow anon full access to operator_activity
DROP POLICY IF EXISTS "Allow public operator_activity" ON operator_activity;
CREATE POLICY "Allow public operator_activity" ON operator_activity
  FOR ALL
  USING (true)
  WITH CHECK (true);
