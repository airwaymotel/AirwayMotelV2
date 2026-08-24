import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUser, hasPermission } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(user, 'view_payments')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!supabase) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .order('paid_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(user, 'view_payments')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!supabase) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  const body = await req.json();
  const allowed = {
    stay_id: body.stay_id, amount: body.amount, method: body.method, notes: body.notes,
  };
  const { data, error } = await supabase.from('payments').insert(allowed).select().single();

  if (error) return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
