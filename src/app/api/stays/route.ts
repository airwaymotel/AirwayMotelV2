import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUser, hasPermission } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(user, 'view_guests')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!supabase) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const { data, error } = await supabase
    .from('stays')
    .select('*, guests(*), rooms(*), payments(*)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Failed to fetch stays' }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(user, 'check_in')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!supabase) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const body = await req.json();
  const allowed = {
    guest_id: body.guest_id, room_id: body.room_id, check_in_date: body.check_in_date,
    check_out_date: body.check_out_date, rate_per_night: body.rate_per_night,
    total_amount: body.total_amount, status: body.status, notes: body.notes,
    weekly_discount: body.weekly_discount, weekly_discount_amount: body.weekly_discount_amount,
  };
  const { data, error } = await supabase.from('stays').insert(allowed).select().single();

  if (error) return NextResponse.json({ error: 'Failed to create stay' }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(user, 'check_in')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!supabase) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const { id, ...updates } = await req.json();
  if (!id) return NextResponse.json({ error: 'Stay ID is required' }, { status: 400 });

  const allowed: Record<string, unknown> = {};
  for (const key of ['check_in_date', 'check_out_date', 'rate_per_night', 'total_amount', 'status', 'notes', 'weekly_discount', 'weekly_discount_amount']) {
    if (key in updates) allowed[key] = updates[key];
  }

  const { data, error } = await supabase.from('stays').update(allowed).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: 'Failed to update stay' }, { status: 500 });
  return NextResponse.json(data);
}
