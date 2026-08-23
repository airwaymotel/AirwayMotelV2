import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUser, hasPermission } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(user, 'view_guests')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!supabase) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const stayId = searchParams.get('stay_id');

  let query = supabase.from('signatures').select('*').order('signed_at', { ascending: false });
  if (stayId) query = query.eq('stay_id', stayId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Failed to fetch signatures' }, { status: 500 });
  return NextResponse.json(data);
}
