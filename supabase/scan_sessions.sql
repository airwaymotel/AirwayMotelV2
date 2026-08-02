-- AIRWAY MOTEL - SCAN SESSIONS TABLE
-- Run this once in your Supabase SQL Editor.
--
-- The phone scan flow (front-AI and barcode) uses this table as the real-time
-- transport between the guest's phone and the admin desktop:
--   1. Desktop creates a row (status = 'waiting') and embeds its id in the QR code.
--   2. Phone opens /scan/{id}, captures the ID (+ optional barcode parse),
--      shows terms, captures a signature, uploads the image to the 'ids' bucket,
--      then updates the row (status = 'received').
--   3. Desktop polls GET /api/scan-session every ~2s, reads the received row,
--      auto-fills the form + signature, then deletes the row (status = 'consumed').
--
-- No supabase_realtime publication change is required — polling only.

CREATE TABLE IF NOT EXISTS scan_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status TEXT NOT NULL DEFAULT 'waiting',    -- 'waiting' | 'received' | 'consumed'
    mode TEXT NOT NULL,                        -- 'photo' | 'barcode'
    image_base64 TEXT,                         -- captured frame / data URL
    image_storage_url TEXT,                    -- public URL of the image in the 'ids' bucket
    parsed_data JSONB,                         -- AAMVA-parsed object (barcode mode)
    signature_data_url TEXT,                   -- PNG signature data URL
    terms_accepted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '15 minutes'
);

-- Index for desktop polling lookups
CREATE INDEX IF NOT EXISTS scan_sessions_status_idx ON scan_sessions (status);

-- Row Level Security — mirrors the wide-open policy used by the other tables
-- in 00_schema.sql (no auth screen yet). Tighten before production.
ALTER TABLE scan_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON scan_sessions;
CREATE POLICY "Enable all access for all users" ON scan_sessions
    FOR ALL USING (true) WITH CHECK (true);
