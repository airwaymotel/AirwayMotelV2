import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  if (!supabase) {
    return NextResponse.json({ permissions: [] });
  }

  const { id } = await params;

  const { data, error } = await supabase
    .from('operator_permissions')
    .select('permission, enabled')
    .eq('user_id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ permissions: data || [] });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const { id } = await params;
  const { permissions } = await req.json() as { permissions: { permission: string; enabled: boolean }[] };

  if (!Array.isArray(permissions)) {
    return NextResponse.json({ error: 'Permissions must be an array' }, { status: 400 });
  }

  // Upsert each permission
  for (const p of permissions) {
    await supabase
      .from('operator_permissions')
      .upsert(
        { user_id: id, permission: p.permission, enabled: p.enabled },
        { onConflict: 'user_id,permission' }
      );
  }

  return NextResponse.json({ ok: true });
}
