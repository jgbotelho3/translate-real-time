import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { sessionStore } from '@/lib/session-store'

export const runtime = 'nodejs'

// sessionStore is now a global-backed Map shared with server.ts.
// See src/lib/session-store.ts for rationale.

export async function POST(request: Request) {
  let body: { languages?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const languages = Array.isArray(body.languages) && body.languages.length > 0 ? body.languages : ['es']

  // Session ID used to correlate speaker:join with the chosen languages.
  // The actual OpenAI connection is opened server-side in server.ts using
  // the OPENAI_API_KEY — no ephemeral key needed for a server-proxy architecture.
  const sessionId = randomUUID()
  sessionStore.set(sessionId, { languages, createdAt: Date.now() })

  return NextResponse.json({ sessionId, languages })
}
