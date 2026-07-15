import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Validates the Speaker Mode access code against SPEAKER_ACCESS_CODE (server-only env).
// The code never reaches the client bundle — it is only compared here.
export async function POST(request: Request) {
  let body: { code?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const expected = process.env.SPEAKER_ACCESS_CODE
  if (!expected) {
    // Misconfiguration — deny rather than allow open access.
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  if (body.code !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  return NextResponse.json({ ok: true })
}
