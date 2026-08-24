import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUser, hasPermission } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(user, 'view_rooms')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!supabase) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .order('room_number', { ascending: true });

  if (error) return NextResponse.json({ error: 'Failed to fetch rooms' }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(user, 'edit_rooms')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!supabase) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const body = await req.json();
  const allowed = { room_number: body.room_number, type: body.type, status: body.status, floor: body.floor ?? 1 };
  const { data, error } = await supabase.from('rooms').insert(allowed).select().single();

  if (error) return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(user, 'edit_rooms')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!supabase) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const { id, ...updates } = await req.json();
  if (!id) return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });

  const allowed: Record<string, unknown> = {};
  for (const key of ['room_number', 'type', 'status']) {
    if (key in updates) allowed[key] = updates[key];
  }

  const { data, error } = await supabase.from('rooms').update(allowed).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: 'Failed to update room' }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(user, 'edit_rooms')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!supabase) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });

  const { error } = await supabase.from('rooms').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Failed to delete room' }, { status: 500 });
  return NextResponse.json({ success: true });
}
