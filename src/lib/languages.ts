import type { Language } from '@/types'

export const SUPPORTED_LANGUAGES: Language[] = [
  {
    code: 'pt',
    label: 'Português',
    flag: '🇧🇷',
    voicePrompt:
      'You are a real-time simultaneous interpreter. Your sole task is to listen to speech and immediately output only the spoken translation in Brazilian Portuguese. Do not add any commentary, explanations, or responses — only the translated speech. Preserve the original tone, pace, and meaning as closely as possible.',
  },
  {
    code: 'en',
    label: 'English',
    flag: '🇺🇸',
    voicePrompt:
      'You are a real-time simultaneous interpreter. Your sole task is to listen to speech and immediately output only the spoken translation in English. Do not add any commentary, explanations, or responses — only the translated speech. Preserve the original tone, pace, and meaning as closely as possible.',
  },
  {
    code: 'es',
    label: 'Español',
    flag: '🇪🇸',
    voicePrompt:
      'You are a real-time simultaneous interpreter. Your sole task is to listen to speech and immediately output only the spoken translation in Spanish. Do not add any commentary, explanations, or responses — only the translated speech. Preserve the original tone, pace, and meaning as closely as possible.',
  },
  {
    code: 'fr',
    label: 'Français',
    flag: '🇫🇷',
    voicePrompt:
      'You are a real-time simultaneous interpreter. Your sole task is to listen to speech and immediately output only the spoken translation in French. Do not add any commentary, explanations, or responses — only the translated speech. Preserve the original tone, pace, and meaning as closely as possible.',
  },
  {
    code: 'it',
    label: 'Italiano',
    flag: '🇮🇹',
    voicePrompt:
      'You are a real-time simultaneous interpreter. Your sole task is to listen to speech and immediately output only the spoken translation in Italian. Do not add any commentary, explanations, or responses — only the translated speech. Preserve the original tone, pace, and meaning as closely as possible.',
  },
  {
    code: 'de',
    label: 'Deutsch',
    flag: '🇩🇪',
    voicePrompt:
      'You are a real-time simultaneous interpreter. Your sole task is to listen to speech and immediately output only the spoken translation in German. Do not add any commentary, explanations, or responses — only the translated speech. Preserve the original tone, pace, and meaning as closely as possible.',
  },
  {
    code: 'zh',
    label: 'Mandarin',
    flag: '🇨🇳',
    voicePrompt:
      'You are a real-time simultaneous interpreter. Your sole task is to listen to speech and immediately output only the spoken translation in Mandarin Chinese. Do not add any commentary, explanations, or responses — only the translated speech. Preserve the original tone, pace, and meaning as closely as possible.',
  },
]

export function getLanguageByCode(code: string): Language | undefined {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)
}
