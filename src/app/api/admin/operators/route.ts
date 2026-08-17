import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { OperatorWithStats } from '@/lib/auth-types';

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  if (!supabase) {
    return NextResponse.json({ operators: [] });
  }

  // Fetch all operators
  const { data: operators, error } = await supabase
    .from('users')
    .select('id, username, full_name, role, is_active, created_at')
    .neq('role', 'super_admin')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch permissions and activity stats for each operator
  const operatorsWithStats: OperatorWithStats[] = await Promise.all(
    (operators || []).map(async (op) => {
      const { data: perms } = await supabase
        .from('operator_permissions')
        .select('permission, enabled')
        .eq('user_id', op.id);

      const permissions = (perms || [])
        .filter(p => p.enabled)
        .map(p => p.permission);

      const { data: activity } = await supabase
        .from('operator_activity')
        .select('action, amount')
        .eq('operator_id', op.id);

      const totalCheckIns = (activity || []).filter(a => a.action === 'check_in').length;
      const totalRevenue = (activity || []).reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

      return {
        id: op.id,
        username: op.username,
        full_name: op.full_name,
        role: op.role,
        is_active: op.is_active,
        created_at: op.created_at,
        permissions,
        total_check_ins: totalCheckIns,
        total_revenue: totalRevenue,
      };
    })
  );

  return NextResponse.json({ operators: operatorsWithStats });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const { username, password, full_name } = await req.json();

  if (!username || !password || !full_name) {
    return NextResponse.json({ error: 'Username, password, and full name are required' }, { status: 400 });
  }

  // Check if username already exists
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .single();

  if (existing) {
    return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
  }

  // Create operator
  const { data: newOp, error } = await supabase
    .from('users')
    .insert({
      username,
      password_hash: password,
      full_name,
      role: 'operator',
      is_active: true,
    })
    .select('id, username, full_name, role, is_active, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Create default permissions (all disabled)
  const permissions = [
    'check_in', 'view_dashboard', 'view_rooms', 'view_guests',
    'view_payments', 'download_receipts', 'download_forms',
  ];

  await supabase.from('operator_permissions').insert(
    permissions.map(p => ({
      user_id: newOp.id,
      permission: p,
      enabled: false,
    }))
  );

  return NextResponse.json({
    operator: {
      ...newOp,
      permissions: [],
      total_check_ins: 0,
      total_revenue: 0,
    },
  }, { status: 201 });
}
