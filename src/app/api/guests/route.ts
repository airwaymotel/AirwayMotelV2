import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUser, hasPermission } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(user, 'view_guests')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!supabase) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const { data, error } = await supabase
    .from('guests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Failed to fetch guests' }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(user, 'check_in')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!supabase) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const body = await req.json();
  const allowed = {
    first_name: body.first_name, last_name: body.last_name, phone: body.phone,
    email: body.email, id_number: body.id_number, date_of_birth: body.date_of_birth,
    id_photo_url: body.id_photo_url, id_type: body.id_type, id_state: body.id_state,
  };
  const { data, error } = await supabase.from('guests').insert(allowed).select().single();

  if (error) return NextResponse.json({ error: 'Failed to create guest' }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(user, 'edit_guests')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!supabase) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const { id, ...updates } = await req.json();
  if (!id) return NextResponse.json({ error: 'Guest ID is required' }, { status: 400 });

  const allowed: Record<string, unknown> = {};
  for (const key of ['first_name', 'last_name', 'phone', 'email', 'id_number', 'date_of_birth', 'id_photo_url', 'id_type', 'id_state']) {
    if (key in updates) allowed[key] = updates[key];
  }

  const { data, error } = await supabase.from('guests').update(allowed).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: 'Failed to update guest' }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(user, 'edit_guests')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!supabase) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Guest ID is required' }, { status: 400 });

  const { data: stays } = await supabase.from('stays').select('id').eq('guest_id', id);
  const stayIds = stays?.map((s: { id: string }) => s.id) || [];

  if (stayIds.length > 0) {
    await supabase.from('payments').delete().in('stay_id', stayIds);
    await supabase.from('signatures').delete().eq('guest_id', id);
    await supabase.from('stays').delete().eq('guest_id', id);
  }

  const { error } = await supabase.from('guests').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Failed to delete guest' }, { status: 500 });
  return NextResponse.json({ success: true });
}
