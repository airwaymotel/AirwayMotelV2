import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .order('room_number', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  const body = await request.json();
  const { data, error } = await supabase.from('rooms').insert(body).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  const { id, ...updates } = await request.json();
  const { data, error } = await supabase.from('rooms').update(updates).eq('id', id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });

  const { error } = await supabase.from('rooms').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
