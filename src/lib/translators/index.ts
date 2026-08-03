import type OpenAI from 'openai'
import type { GoogleGenAI } from '@google/genai'
import { SUPPORTED_LANGUAGES } from '../languages'
import type { RealtimeTranslator, TranslatorCallbacks, TranslationProvider } from './types'
import { createOpenAITranslator } from './openai-translator'
import { createGeminiTranslator } from './gemini-translator'

export interface TranslatorDeps {
  openaiClient: OpenAI
  /** Lazily built so GoogleGenAI (and GEMINI_API_KEY) is only required in gemini mode. */
  getGenai: () => GoogleGenAI
}

// Map our internal language codes to BCP-47 for Gemini's targetLanguageCode.
function toBcp47(code: string): string {
  const map: Record<string, string> = { pt: 'pt-BR', zh: 'cmn-CN' }
  return map[code] ?? code
}

export function createTranslator(
  langCode: string,
  provider: TranslationProvider,
  callbacks: TranslatorCallbacks,
  deps: TranslatorDeps,
): RealtimeTranslator {
  if (provider === 'gemini') {
    return createGeminiTranslator(langCode, toBcp47(langCode), callbacks, deps.getGenai())
  }
  const lang = SUPPORTED_LANGUAGES.find((l) => l.code === langCode)
  const voicePrompt = lang?.voicePrompt ?? `Translate the incoming speech to ${langCode}.`
  return createOpenAITranslator(langCode, voicePrompt, callbacks, deps.openaiClient)
}

export { getTranslationProvider } from './types'
export type { RealtimeTranslator, TranslatorCallbacks } from './types'
