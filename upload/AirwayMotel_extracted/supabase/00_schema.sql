-- AIRWAY MOTEL - SUPABASE DATABASE SCHEMA
-- Run this script in your Supabase SQL Editor to initialize the database tables.

-- 1. ROOMS
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_number TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL, -- '1-bed' or '2-bed'
    status TEXT NOT NULL DEFAULT 'available', -- 'available', 'occupied', 'maintenance', 'reserved', 'cleaning'
    floor INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. GUESTS
CREATE TABLE IF NOT EXISTS guests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth DATE,
    id_number TEXT,
    id_type TEXT,
    id_state TEXT,
    id_photo_url TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    phone TEXT,
    email TEXT,
    sex TEXT,
    eye_color TEXT,
    height TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. STAYS
CREATE TABLE IF NOT EXISTS stays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
    rate_type TEXT NOT NULL, -- 'daily' or 'weekly'
    rate_amount NUMERIC NOT NULL,
    check_in_date DATE NOT NULL,
    check_in_time TIME NOT NULL,
    check_out_date DATE NOT NULL,
    check_out_time TIME NOT NULL,
    actual_check_out TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'checked_out', 'evicted', 'no_show'
    late_fee NUMERIC DEFAULT 0,
    key_deposit NUMERIC DEFAULT 10,
    tv_remote_deposit NUMERIC DEFAULT 10,
    number_of_guests INTEGER DEFAULT 1,
    vehicle JSONB, -- Stores {make, model, licensePlate, color, year}
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. SIGNATURES
CREATE TABLE IF NOT EXISTS signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stay_id UUID NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    signature_data_url TEXT NOT NULL, -- The base64 or storage url of the signature
    signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stay_id UUID NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    method TEXT NOT NULL, -- 'cash' or 'card'
    receipt_generated BOOLEAN DEFAULT FALSE,
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT
);

-- Set up Row Level Security (RLS)
-- By default, allow all operations for authenticated users (or public for MVP, depending on auth setup)
-- For MVP, we will enable RLS but set policies to allow anon/public access since there is no login screen yet.
-- IMPORTANT: Remove these permissive policies before going to production!

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for all users" ON rooms FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for all users" ON guests FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE stays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for all users" ON stays FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for all users" ON signatures FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for all users" ON payments FOR ALL USING (true) WITH CHECK (true);
