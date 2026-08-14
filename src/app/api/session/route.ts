import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { sessionStore } from '@/lib/session-store'

export const runtime = 'nodejs'

// sessionStore is now a global-backed Map shared with server.ts.
// See src/lib/session-store.ts for rationale.

export async function POST(request: Request) {
  let body: { languages?: string[]; code?: string; sessionId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Gate broadcasting behind the Speaker Mode access code (server-only env).
  const expectedCode = process.env.SPEAKER_ACCESS_CODE
  if (!expectedCode || body.code !== expectedCode) {
    return NextResponse.json({ error: 'Invalid access code' }, { status: 403 })
  }

  const languages = Array.isArray(body.languages) && body.languages.length > 0 ? body.languages : ['es']

  // Reuse the speaker's stable session ID when provided (so the listener URL
  // stays the same across restarts/disconnects); otherwise generate a new one.
  const sessionId =
    typeof body.sessionId === 'string' && body.sessionId.length > 0 ? body.sessionId : randomUUID()
  sessionStore.set(sessionId, { languages, createdAt: Date.now() })

  return NextResponse.json({ sessionId, languages })
}
