import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createSessionToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// Simple in-memory rate limiter: 5 attempts per minute per IP
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  record.count++;
  return record.count > RATE_LIMIT;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';

    if (isRateLimited(ip)) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    }

    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
    }

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

    const passwordValid = user.password_hash.startsWith('$2')
      ? await bcrypt.compare(password, user.password_hash)
      : user.password_hash === password;

    if (!passwordValid) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    let permissions: string[];
    if (user.role === 'super_admin') {
      permissions = ['check_in', 'view_dashboard', 'view_rooms', 'view_guests', 'view_payments', 'download_receipts', 'download_forms', 'edit_guests', 'edit_rooms', 'manage_discounts'];
    } else {
      const { data: perms } = await supabase
        .from('operator_permissions')
        .select('permission, enabled')
        .eq('user_id', user.id);
      permissions = (perms || []).filter((p: { enabled: boolean }) => p.enabled).map((p: { permission: string }) => p.permission);
    }

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
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
