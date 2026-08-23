import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// ONE-TIME USE: Visit /api/admin/migrate-passwords while logged in as super admin
// This hashes all plaintext passwords in the users table with bcrypt.
// Delete this file after running once.

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
    }

    // Fetch all users
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('id, password_hash');

    if (fetchError || !users) {
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    let migrated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const u of users) {
      // Skip if already hashed (bcrypt hashes start with $2)
      if (u.password_hash && u.password_hash.startsWith('$2')) {
        skipped++;
        continue;
      }

      const hashed = await bcrypt.hash(u.password_hash, 10);
      const { error: updateError } = await supabase
        .from('users')
        .update({ password_hash: hashed })
        .eq('id', u.id);

      if (updateError) {
        errors.push(`Failed for user ${u.id}: ${updateError.message}`);
      } else {
        migrated++;
      }
    }

    return NextResponse.json({
      ok: true,
      total: users.length,
      migrated,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch {
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }
}
