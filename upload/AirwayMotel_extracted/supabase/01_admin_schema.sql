-- AIRWAY MOTEL - ADMIN TABLE SCHEMA
-- Run this script in your Supabase SQL Editor to create the admin table and set the default password.

CREATE TABLE IF NOT EXISTS admin (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    password TEXT NOT NULL
);

-- Insert the default password '1234' if the table is empty
INSERT INTO admin (password) 
SELECT '1234'
WHERE NOT EXISTS (SELECT 1 FROM admin);

-- Set up Row Level Security (RLS)
ALTER TABLE admin ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for all users" ON admin FOR ALL USING (true) WITH CHECK (true);
