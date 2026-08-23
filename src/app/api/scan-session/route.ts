import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function noDb() {
  return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
}

async function cleanupExpired() {
  if (!supabase) return;
  await supabase.from('scan_sessions').delete().lt('expires_at', new Date().toISOString());
}

// GET: Desktop polls for result (requires auth)
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabase) return noDb();

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

  const { data: session, error } = await supabase
    .from('scan_sessions')
    .select('status, mode, image_base64, image_storage_url, parsed_data, signature_data_url, terms_accepted')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  if (session.status === 'received') {
    return NextResponse.json({
      status: 'received', mode: session.mode,
      imageBase64: session.image_base64, imageStorageUrl: session.image_storage_url,
      parsedData: session.parsed_data, signatureDataUrl: session.signature_data_url,
      termsAccepted: !!session.terms_accepted,
    });
  }

  return NextResponse.json({ status: session.status });
}

// POST: Create session (auth required) or upload phone result (no auth - guest device)
export async function POST(req: NextRequest) {
  if (!supabase) return noDb();

  try {
    const body = await req.json();
    const { action, sessionId } = body;

    if (action === 'create') {
      const user = await getSessionUser(req);
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      await cleanupExpired();
      const mode = body.mode === 'barcode' ? 'barcode' : 'photo';
      const id = sessionId || crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      const { error } = await supabase.from('scan_sessions').insert({ id, status: 'waiting', mode, expires_at: expiresAt });
      if (error) return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });

      return NextResponse.json({ sessionId: id, status: 'waiting' });
    }

    if (action === 'upload') {
      const { imageBase64, imageStorageUrl, parsedData, signatureDataUrl, termsAccepted } = body;
      if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

      const { error } = await supabase
        .from('scan_sessions')
        .update({
          status: 'received', image_base64: imageBase64 ?? null,
          image_storage_url: imageStorageUrl ?? null, parsed_data: parsedData ?? null,
          signature_data_url: signatureDataUrl ?? null, terms_accepted: !!termsAccepted,
        })
        .eq('id', sessionId);

      if (error) return NextResponse.json({ error: 'Failed to upload' }, { status: 500 });
      return NextResponse.json({ status: 'received' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE: Desktop marks consumed (requires auth)
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabase) return noDb();

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

  const { error } = await supabase.from('scan_sessions').update({ status: 'consumed' }).eq('id', sessionId);
  if (error) return NextResponse.json({ error: 'Failed to consume session' }, { status: 500 });

  return NextResponse.json({ status: 'consumed' });
}
