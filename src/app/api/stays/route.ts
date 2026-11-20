import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUser, hasPermission } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(user, 'view_guests')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!supabase) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  let { data, error } = await supabase
    .from('stays')
    .select('*, guests(*), rooms(*), payments(*), stay_guest_members(*)')
    .order('created_at', { ascending: false });

  // Fall back for deployments before the party-membership migration is run.
  if (error) {
    const fallback = await supabase
      .from('stays')
      .select('*, guests(*), rooms(*), payments(*)')
      .order('created_at', { ascending: false });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) return NextResponse.json({ error: 'Failed to fetch stays' }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(user, 'check_in')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!supabase) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const body = await req.json();
  const companionGuestIds = Array.isArray(body.companion_guest_ids)
    ? body.companion_guest_ids.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
    : [];
  const guestCount = Math.max(1, companionGuestIds.length + 1);
  const allowed = {
    guest_id: body.guest_id, room_id: body.room_id, rate_type: body.rate_type,
    rate_amount: body.rate_amount, check_in_date: body.check_in_date,
    check_in_time: body.check_in_time,
    check_out_date: body.check_out_date || null,
    check_out_time: body.check_out_time || null,
    status: body.status,
    guest_count: guestCount,
  };
  let { data, error } = await supabase.from('stays').insert(allowed).select().single();

  // Graceful fallback if guest_count column does not exist yet
  if (error && (error.message?.includes('guest_count') || error.code === '42703')) {
    const { guest_count, ...allowedWithoutGuestCount } = allowed;
    const retry = await supabase.from('stays').insert(allowedWithoutGuestCount).select().single();
    data = retry.data;
    error = retry.error;
  }

  if (error) return NextResponse.json({ error: 'Failed to create stay' }, { status: 500 });

  const memberGuestIds = [body.guest_id, ...companionGuestIds].filter(
    (id: unknown, index: number, ids: unknown[]) => typeof id === 'string' && ids.indexOf(id) === index,
  );
  if (memberGuestIds.length > 0) {
    const memberRows = memberGuestIds.map((guestId: string, index: number) => ({
      stay_id: data.id,
      guest_id: guestId,
      is_primary: index === 0,
    }));
    const { error: membersError } = await supabase.from('stay_guest_members').insert(memberRows);
    if (membersError) {
      console.error('Failed to save stay guest members:', membersError);
    }
  }

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
  for (const key of ['guest_id', 'room_id', 'rate_type', 'rate_amount', 'check_in_date', 'check_in_time', 'check_out_date', 'check_out_time', 'status']) {
    if (key in updates) allowed[key] = updates[key];
  }

  const { data, error } = await supabase.from('stays').update(allowed).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: 'Failed to update stay' }, { status: 500 });
  return NextResponse.json(data);
}
