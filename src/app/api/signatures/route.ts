import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const stayId = searchParams.get('stay_id');

  let query = supabase.from('signatures').select('*').order('signed_at', { ascending: false });

  if (stayId) {
    query = query.eq('stay_id', stayId);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
