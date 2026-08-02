import { NextResponse } from 'next/server';

// ── In-memory scan session store ──────────────────────────────────
// Works without Supabase. For a single-server motel setup this is fine.
// Sessions auto-expire after 10 minutes.

interface ScanSession {
  status: 'waiting' | 'received';
  imageBase64?: string;
  createdAt: number;
}

const sessions = new Map<string, ScanSession>();

// Cleanup old sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > 10 * 60 * 1000) {
      sessions.delete(id);
    }
  }
}, 5 * 60 * 1000);

// ── GET: Check session status (computer polls this) ──
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  const session = sessions.get(sessionId);

  if (!session) {
    return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
  }

  if (session.status === 'received' && session.imageBase64) {
    // Return the image data and clean up
    const imageBase64 = session.imageBase64;
    sessions.delete(sessionId);
    return NextResponse.json({ status: 'received', imageBase64 });
  }

  return NextResponse.json({ status: 'waiting' });
}

// ── POST: Create session or upload image ──
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, sessionId, imageBase64 } = body;

    if (action === 'create') {
      // Create a new scan session
      const id = sessionId || crypto.randomUUID();
      sessions.set(id, { status: 'waiting', createdAt: Date.now() });
      return NextResponse.json({ sessionId: id, status: 'waiting' });
    }

    if (action === 'upload') {
      // Phone uploads the captured image
      if (!sessionId || !imageBase64) {
        return NextResponse.json({ error: 'Missing sessionId or imageBase64' }, { status: 400 });
      }

      const session = sessions.get(sessionId);
      if (!session) {
        return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
      }

      session.status = 'received';
      session.imageBase64 = imageBase64;

      return NextResponse.json({ status: 'received', message: 'Image uploaded successfully' });
    }

    return NextResponse.json({ error: 'Invalid action. Use "create" or "upload"' }, { status: 400 });
  } catch (error) {
    console.error('Scan session error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
