import { cookies } from 'next/headers';
import { supabase } from './supabase';
import type { AuthUser, Permission, UserRole, SUPER_ADMIN_PERMISSIONS } from './auth-types';

const SESSION_COOKIE = 'airway_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'airway-motel-secret-key-2024';

// Simple base64 session token (no crypto needed for this use case)
export function createSessionToken(userId: string): string {
  const payload = JSON.stringify({ userId, ts: Date.now() });
  return Buffer.from(payload).toString('base64url');
}

export function parseSessionToken(token: string): { userId: string } | null {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64url').toString());
    // Expire after 24 hours
    if (Date.now() - payload.ts > 24 * 60 * 60 * 1000) return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const parsed = parseSessionToken(token);
    if (!parsed) return null;

    if (!supabase) return null;

    // Fetch user
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, full_name, role, is_active')
      .eq('id', parsed.userId)
      .single();

    if (error || !user || !user.is_active) return null;

    // Fetch permissions
    const { data: perms } = await supabase
      .from('operator_permissions')
      .select('permission, enabled')
      .eq('user_id', user.id);

    const permissions: Permission[] = user.role === 'super_admin'
      ? ['check_in', 'view_dashboard', 'view_rooms', 'view_guests', 'view_payments', 'download_receipts', 'download_forms']
      : (perms || []).filter(p => p.enabled).map(p => p.permission as Permission);

    return {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role as UserRole,
      permissions,
    };
  } catch {
    return null;
  }
}

export function hasPermission(user: AuthUser | null, permission: Permission): boolean {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  return user.permissions.includes(permission);
}
