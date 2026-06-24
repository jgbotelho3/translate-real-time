// Shared in-memory session store backed by a global variable.
//
// Problem this solves: Next.js compiles API routes through its own module
// system (webpack/Turbopack), which is separate from Node's native require
// cache. When server.ts does `import('./src/app/api/session/route')`, Node
// loads a fresh module instance with an empty Map — different from the one
// that handled the HTTP request. Using `globalThis` ensures both sides share
// the exact same Map instance within the same process.

export interface StoredSession {
  languages: string[]
  createdAt: number
}

declare global {
  // eslint-disable-next-line no-var
  var __sessionStore: Map<string, StoredSession> | undefined
}

export const sessionStore: Map<string, StoredSession> =
  globalThis.__sessionStore ?? (globalThis.__sessionStore = new Map())

// Clean up sessions older than 5 minutes
setInterval(
  () => {
    const now = Date.now()
    for (const [id, session] of sessionStore.entries()) {
      if (now - session.createdAt > 5 * 60 * 1000) {
        sessionStore.delete(id)
      }
    }
  },
  5 * 60 * 1000,
)
