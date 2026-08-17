import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  if (!supabase) {
    return NextResponse.json({ activities: [] });
  }

  const { id } = await params;
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');

  const { data: activities, error } = await supabase
    .from('operator_activity')
    .select('*')
    .eq('operator_id', id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with guest names and room numbers
  const enriched = await Promise.all(
    (activities || []).map(async (act) => {
      let guest_name = '';
      let room_number = '';

      if (act.guest_id) {
        const { data: guest } = await supabase
          .from('guests')
          .select('first_name, last_name')
          .eq('id', act.guest_id)
          .single();
        if (guest) guest_name = `${guest.first_name} ${guest.last_name}`;
      }

      if (act.room_id) {
        const { data: room } = await supabase
          .from('rooms')
          .select('room_number')
          .eq('id', act.room_id)
          .single();
        if (room) room_number = room.room_number;
      }

      return { ...act, guest_name, room_number };
    })
  );

  return NextResponse.json({ activities: enriched });
}
