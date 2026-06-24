/**
 * Convert a Float32Array (Web Audio API samples, range -1 to 1) to Int16Array (PCM16).
 */
export function float32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return int16
}

/**
 * Convert an Int16Array (PCM16) to a Float32Array (Web Audio API samples, range -1 to 1).
 */
export function int16ToFloat32(int16: Int16Array): Float32Array {
  const float32 = new Float32Array(int16.length)
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff)
  }
  return float32
}

/**
 * Convert an Int16Array to a base64 string.
 */
export function int16ToBase64(int16: Int16Array): string {
  const bytes = new Uint8Array(int16.buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Convert a base64 string to an Int16Array.
 */
export function base64ToInt16(base64: string): Int16Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Int16Array(bytes.buffer)
}

/**
 * Convert a Float32Array to a base64-encoded PCM16 string.
 * Used to send mic audio over Socket.IO.
 */
export function float32ToBase64Pcm16(float32: Float32Array): string {
  return int16ToBase64(float32ToInt16(float32))
}

/**
 * Convert a base64-encoded PCM16 string back to Float32Array for Web Audio playback.
 */
export function base64Pcm16ToFloat32(base64: string): Float32Array {
  return int16ToFloat32(base64ToInt16(base64))
}

/**
 * Convert a base64 string to a Node.js Buffer (server-side only).
 * Used in server.ts to forward audio to OpenAI Realtime API.
 */
export function base64ToBuffer(base64: string): Buffer {
  return Buffer.from(base64, 'base64')
}
