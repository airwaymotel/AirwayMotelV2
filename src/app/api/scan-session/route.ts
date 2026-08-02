import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// ── Scan session store (Supabase-backed) ───────────────────────────
// The phone scan flow (front-AI and barcode) uses the scan_sessions table as
// the real-time transport between the guest's phone and the admin desktop.
// Requires the scan_sessions table — run supabase/scan_sessions.sql once.
//
// Lifecycle:
//   POST create  -> desktop inserts a 'waiting' row
//   GET          -> desktop polls every ~2s until the row is 'received'
//   POST upload  -> phone updates the row to 'received' with image/parse/signature
//   DELETE       -> desktop marks the row 'consumed' after reading it

export const dynamic = 'force-dynamic';

const NO_DB_MSG =
  'Scan sessions require the scan_sessions table. Run supabase/scan_sessions.sql in your Supabase SQL editor.';

function noDb() {
  return NextResponse.json({ error: NO_DB_MSG }, { status: 503 });
}

async function cleanupExpired() {
  if (!supabase) return;
  await supabase.from('scan_sessions').delete().lt('expires_at', new Date().toISOString());
}

// ── GET: Desktop polls for the result ──
export async function GET(request: Request) {
  if (!supabase) return noDb();

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  const { data: session, error } = await supabase
    .from('scan_sessions')
    .select('status, mode, image_base64, image_storage_url, parsed_data, signature_data_url, terms_accepted')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) {
    console.error('[scan-session] GET error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!session) {
    return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
  }

  if (session.status === 'received') {
    return NextResponse.json({
      status: 'received',
      mode: session.mode,
      imageBase64: session.image_base64,
      imageStorageUrl: session.image_storage_url,
      parsedData: session.parsed_data,
      signatureDataUrl: session.signature_data_url,
      termsAccepted: !!session.terms_accepted,
    });
  }

  return NextResponse.json({ status: session.status });
}

// ── POST: Create session or upload phone result ──
export async function POST(request: Request) {
  if (!supabase) return noDb();

  try {
    const body = await request.json();
    const { action, sessionId } = body;

    if (action === 'create') {
      // Cheap cleanup of stale rows on each new session
      await cleanupExpired();

      const mode = body.mode === 'barcode' ? 'barcode' : 'photo';
      const id = sessionId || crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      const { error } = await supabase.from('scan_sessions').insert({
        id,
        status: 'waiting',
        mode,
        expires_at: expiresAt,
      });

      if (error) {
        console.error('[scan-session] create error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ sessionId: id, status: 'waiting' });
    }

    if (action === 'upload') {
      // Phone uploads the captured image (+ optional parsed barcode + signature)
      const { imageBase64, imageStorageUrl, parsedData, signatureDataUrl, termsAccepted } = body;

      if (!sessionId) {
        return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
      }

      const { error } = await supabase
        .from('scan_sessions')
        .update({
          status: 'received',
          image_base64: imageBase64 ?? null,
          image_storage_url: imageStorageUrl ?? null,
          parsed_data: parsedData ?? null,
          signature_data_url: signatureDataUrl ?? null,
          terms_accepted: !!termsAccepted,
        })
        .eq('id', sessionId);

      if (error) {
        console.error('[scan-session] upload error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ status: 'received', message: 'Image uploaded successfully' });
    }

    return NextResponse.json({ error: 'Invalid action. Use "create" or "upload"' }, { status: 400 });
  } catch (error) {
    console.error('Scan session error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ── DELETE: Desktop marks the row consumed after reading it ──
export async function DELETE(request: Request) {
  if (!supabase) return noDb();

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  const { error } = await supabase
    .from('scan_sessions')
    .update({ status: 'consumed' })
    .eq('id', sessionId);

  if (error) {
    console.error('[scan-session] delete error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: 'consumed' });
}
