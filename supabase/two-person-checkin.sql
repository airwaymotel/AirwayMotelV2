-- AIRWAY MOTEL - TWO-PERSON CHECK-IN MIGRATION
-- Run once in Supabase SQL Editor.

ALTER TABLE stays
  ADD COLUMN IF NOT EXISTS guest_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS party_id UUID DEFAULT gen_random_uuid();

CREATE TABLE IF NOT EXISTS stay_guest_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stay_id UUID NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (stay_id, guest_id)
);

CREATE INDEX IF NOT EXISTS stay_guest_members_stay_idx ON stay_guest_members(stay_id);
CREATE INDEX IF NOT EXISTS stay_guest_members_guest_idx ON stay_guest_members(guest_id);

ALTER TABLE stay_guest_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for stay guest members" ON stay_guest_members;
CREATE POLICY "Enable all access for stay guest members"
  ON stay_guest_members FOR ALL USING (true) WITH CHECK (true);

-- Backfill existing one-person stays safely.
INSERT INTO stay_guest_members (stay_id, guest_id, is_primary)
SELECT s.id, s.guest_id, TRUE
FROM stays s
WHERE s.guest_id IS NOT NULL
ON CONFLICT (stay_id, guest_id) DO NOTHING;

UPDATE stays
SET guest_count = 1
WHERE guest_count IS NULL OR guest_count < 1;
