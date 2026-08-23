import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabase) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const { data, error } = await supabase
    .from('motel_settings')
    .select('*')
    .eq('id', 'main')
    .single();

  if (error && error.code !== 'PGRST116') return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  if (!data) return NextResponse.json([]);
  return NextResponse.json([data]);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!supabase) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const body = await req.json();
  const allowed = {
    id: body.id, rate_1bed: body.rate_1bed, rate_2bed: body.rate_2bed,
    weekly_discount_amount: body.weekly_discount_amount,
  };
  const { data, error } = await supabase.from('motel_settings').insert(allowed).select().single();

  if (error) return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!supabase) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const { id, ...updates } = await req.json();
  const allowed: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of ['rate_1bed', 'rate_2bed', 'weekly_discount_amount']) {
    if (key in updates) allowed[key] = updates[key];
  }

  const { data, error } = await supabase.from('motel_settings').update(allowed).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  return NextResponse.json(data);
}
