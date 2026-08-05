import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  const { data, error } = await supabase
    .from('guests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  const body = await request.json();
  const { data, error } = await supabase.from('guests').insert(body).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  const { id, ...updates } = await request.json();
  const { data, error } = await supabase.from('guests').update(updates).eq('id', id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Guest ID is required' }, { status: 400 });

  const { data: stays } = await supabase.from('stays').select('id').eq('guest_id', id);
  const stayIds = stays?.map((s) => s.id) || [];

  if (stayIds.length > 0) {
    await supabase.from('payments').delete().in('stay_id', stayIds);
    await supabase.from('signatures').delete().eq('guest_id', id);
    await supabase.from('stays').delete().eq('guest_id', id);
  }

  const { error } = await supabase.from('guests').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
