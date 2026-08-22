import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createSessionToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    // Local fallback without Supabase
    if (!supabase) {
      if (username === 'superadmin' && password === '1234') {
        const token = createSessionToken('local-superadmin');
        return NextResponse.json({
          token,
          user: {
            id: 'local-superadmin',
            username: 'superadmin',
            full_name: 'Super Admin',
            role: 'super_admin',
            permissions: ['check_in', 'view_dashboard', 'view_rooms', 'view_guests', 'view_payments', 'download_receipts', 'download_forms', 'edit_guests', 'edit_rooms', 'manage_discounts'],
          },
        });
      }
      if (username === 'opone' && password === 'op1234') {
        const token = createSessionToken('local-opone');
        return NextResponse.json({
          token,
          user: {
            id: 'local-opone',
            username: 'opone',
            full_name: 'Operator One',
            role: 'operator',
            permissions: ['check_in', 'view_dashboard', 'view_rooms', 'view_guests', 'view_payments', 'download_receipts', 'download_forms', 'edit_guests', 'edit_rooms', 'manage_discounts'],
          },
        });
      }
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    // Supabase: query users table
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, password_hash, full_name, role, is_active')
      .eq('username', username)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    if (!user.is_active) {
      return NextResponse.json({ error: 'Account is disabled. Contact admin.' }, { status: 403 });
    }

    if (user.password_hash !== password) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    // Fetch permissions
    let permissions: string[];
    if (user.role === 'super_admin') {
      permissions = ['check_in', 'view_dashboard', 'view_rooms', 'view_guests', 'view_payments', 'download_receipts', 'download_forms', 'edit_guests', 'edit_rooms', 'manage_discounts'];
    } else {
      const { data: perms } = await supabase
        .from('operator_permissions')
        .select('permission, enabled')
        .eq('user_id', user.id);
      permissions = (perms || []).filter(p => p.enabled).map(p => p.permission);
    }

    // Create session token (returned in JSON, stored in sessionStorage by client)
    const token = createSessionToken(user.id);

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        permissions,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
